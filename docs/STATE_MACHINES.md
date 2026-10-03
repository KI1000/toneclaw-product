# ToneClaw M0 状态机

> 记录时间：2026-10-03 22:35:10 CST
> 状态：M0 草案
> 文档定位：定义主链路对象的状态机、状态职责、关键事件和 P0 边界。
> 上游依据：`docs/CORE_MODEL.md`

## 1. 状态机设计原则

### 1.1 状态只属于一个主对象

一个对象的状态只表达它自己负责的事实，不能把其他对象的状态混进来。

```text
ListingDraft.status 只表达内部草稿准备和审批状态；
PublishJob.status 只表达一次发布动作的执行状态；
Listing.core_status 只表达平台侧真实商品状态；
ApprovalTask.status 只表达人工审批状态；
SyncJob.status 只表达一次同步任务状态。
```

### 1.2 状态变更必须有事件和审计

关键状态变更必须记录：

```text
actor
event
from_state
to_state
reason
occurred_at
```

高风险状态变更还需要 `ApprovalTask`。

### 1.3 失败必须给出下一步

失败状态不能只是 `failed`。

必须附带：

```text
error_code
user_message
retryable
remediation
next_action
```

### 1.4 平台状态必须映射

不允许核心业务直接理解 Temu、TikTok、Amazon 的私有状态。

统一映射方向：

```text
Platform Raw Status
→ ToneClaw Platform Status
→ ToneClaw Core Status
```

## 2. 状态职责总表

| 对象 | 状态负责的事实 | 不负责的事实 |
| --- | --- | --- |
| Store | 店铺连接是否可用 | 商品是否上架 |
| PlatformCredential | 授权凭据是否有效 | 店铺是否可用 |
| StoreCapability | 某项平台能力是否可用 | 全局产品功能开关 |
| DataSource | 数据源是否启用 | 单条货盘是否合格 |
| Supplier | 供应商是否可合作 | 单个商品是否可选 |
| SourcingItem | 货盘数据是否存在、是否合格 | 是否适合某个平台 |
| SelectionDecision | 是否进入卖家商品池 | 是否适合某个平台 |
| Product | ToneClaw 商品是否可经营 | 平台 Listing 是否存在 |
| MediaAsset | 原始媒体是否存在 | 是否符合某个平台规格 |
| MediaVariant | 平台媒体变体是否就绪 | Listing 是否已提交 |
| ContentDraft | 内容候选是否存在、是否被采纳 | Listing 是否已提交 |
| PlatformFitAssessment | 平台适配评估是否完成 | 上架是否成功 |
| ListingDraft | 内部草稿是否准备、校验、审批完成 | 平台真实状态 |
| PublishJob | 一次发布动作是否执行成功 | 商品长期状态 |
| Listing | 平台侧真实商品状态 | 内部草稿是否可编辑 |
| Order | 平台订单状态 | 发货任务是否执行 |
| Fulfillment | 履约 / 发货状态 | 订单是否已支付 |
| ApprovalTask | 人工确认是否完成 | 业务对象自身生命周期 |
| SyncJob | 一次同步任务是否完成 | 业务对象长期状态 |

## 3. 账户与连接状态机

### 3.1 BusinessAccount

状态：

```text
active
suspended
closed
```

创建转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | account.create | active | 创建经营主体和主用户 |

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| active | admin.suspend | suspended | 禁止新的平台同步和高消耗 AI 动作 |
| suspended | admin.reinstate | active | 恢复权限 |
| active / suspended | account.close | closed | 终态；保留审计和数据归档 |

P0 约束：

```text
默认 active；
不支持自助注销。
```

### 3.2 PlatformConnection

状态：

```text
pending
active
expired
revoked
invalid
error
disconnected
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | connection.start | pending | 发起外部平台授权 |
| pending | authorization.success | active | 创建或更新 ExternalSellerAccount / Store |
| pending | authorization.failed | invalid | 记录 ErrorCatalogEntry |
| active | token.expired | expired | 停止自动同步 |
| expired | reauthorization.success | active | 更新 PlatformCredential |
| active / expired / invalid | seller.revoke | revoked | 停止所有平台调用 |
| active / expired / invalid / revoked | platform.error | error | 记录平台异常 |
| active | user.disconnect | disconnected | 保留历史数据 |

P0 约束：

```text
只允许一个 PlatformConnection；
数据模型允许多个 PlatformConnection；
不实现自动刷新，凭据过期后进入 expired。
```

### 3.3 ExternalSellerAccount

状态：

```text
unverified
linked
disconnected
blocked
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | seller.discovered | unverified | 平台返回卖家账号信息 |
| unverified | verification.success | linked | 可发现店铺 |
| linked | verification.failed | unverified | 重新验证 |
| linked | user.disconnect | disconnected | 保留历史数据 |
| linked / unverified | platform.blocked | blocked | 终态；需人工处理 |

### 3.4 Store

状态：

```text
connecting
connected
degraded
disconnected
expired
error
archived
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | store.connect.start | connecting | 创建 Store 和授权流程 |
| connecting | credential.verified | connected | 初始化 StoreCapability |
| connecting | credential.failed | error | 记录 ErrorCatalogEntry |
| connected | credential.expire | expired | 停止自动同步 |
| connected | sync.repeated_failure | degraded | 保留数据，但标记连接异常 |
| degraded | sync.recovered | connected | 清除连接异常 |
| connected / degraded / expired | store.disconnect | disconnected | 停止同步 |
| disconnected / error | store.archive | archived | 终态 |

P0 约束：

```text
只允许一个 active Store；
数据模型允许多个 Store。
```

### 3.5 PlatformCredential

状态：

```text
pending
active
expired
revoked
invalid
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | credential.create | pending | 保存 secret_ref，不保存明文 |
| pending | verification.success | active | 可调用平台 API |
| pending | verification.failed | invalid | 记录失败原因 |
| active | verification.failed | invalid | 触发连接告警 |
| active | token.expired | expired | 需要刷新或重新授权 |
| expired | token.refresh.success | active | 更新 expires_at |
| expired | token.refresh.failed | invalid | 需要重新授权 |
| active / expired | user.revoke | revoked | 停止所有平台调用 |

P0 约束：

```text
Temu 支持的授权类型确认前，不设计自动刷新。
```

### 3.6 StoreCapability

状态：

```text
unknown
checking
available
unavailable
unsupported
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| unknown | capability.check.start | checking | 检查平台 API 能力 |
| checking | capability.available | available | mode = api |
| checking | capability.unavailable | unavailable | mode = manual / export_import |
| checking | capability.unsupported | unsupported | 不实现降级 |
| available / unavailable | capability.recheck.start | checking | 平台文档或版本变化后复查 |

P0 必须检查：

```text
store.read
category.read
attribute.read
listing.create
listing.status.read
order.read
fulfillment.read
settlement.read
```

## 4. 货盘与选品状态机

### 4.1 DataSource

状态：

```text
active
disabled
error
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | datasource.create | active | P0 支持 manual / excel / csv / json |
| active | datasource.disable | disabled | 停止导入 |
| disabled | datasource.enable | active | 恢复导入 |
| active | import.system_error | error | 记录错误 |
| error | datasource.recover | active | 清除系统错误 |

### 4.2 Supplier

状态：

```text
draft
active
paused
blocked
archived
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | supplier.create | draft | 建立供应商档案 |
| draft | supplier.complete | active | 可提供 SourcingItem |
| active | supplier.pause | paused | 暂停新选品 |
| paused | supplier.resume | active | 恢复 |
| active / paused | supplier.block | blocked | 禁止使用 |
| active / paused / blocked | supplier.archive | archived | 终态 |

### 4.3 SourcingItem

状态：

```text
imported
normalizing
candidate
invalid
selected
rejected
archived
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | sourcing.import | imported | 创建 SourceRecord |
| imported | normalize.success | candidate | 进入候选池 |
| imported | normalize.failed | invalid | 记录缺失字段 |
| candidate | selection.approve | selected | 创建 SelectionDecision；Product 继承 SourcingItem.risk_status |
| candidate | selection.reject | rejected | 创建 SelectionDecision |
| candidate | selection.observe | candidate | 保持候选，但记录观察 |
| invalid | user.correct | candidate | 修正后重新进入候选池 |
| selected | selection.reopen | candidate | Guard：没有关联 Product / ListingDraft |
| candidate / selected / rejected | user.archive | archived | 终态 |

说明：

```text
SourcingItem.status 表达货盘数据生命周期；
SelectionDecision 是平台无关选品决策；
PlatformFitAssessment 是平台适配判断。
```

### 4.4 SelectionDecision

决策结果字段：

```text
approved
rejected
observing
```

决策记录状态：

```text
active
superseded
canceled
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | decision.create | active | 保存决策、理由、评分、审计 |
| active | new_decision.create | superseded | 旧决策不再是当前有效决策 |
| active | decision.cancel | canceled | 终态 |

说明：

```text
一个 SourcingItem 可以有多次 SelectionDecision；
当前有效决策只有 status = active 的记录。
```

## 5. 商品与内容状态机

### 5.1 Product

状态：

```text
draft
active
paused
archived
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | product.create | draft | 可来自 SelectionDecision 或手工创建 |
| draft | product.complete | active | 至少有一个 ProductVariant |
| active | product.pause | paused | 不建议新建 Listing |
| paused | product.resume | active | 恢复 |
| active / paused | product.archive | archived | 终态 |

说明：

```text
Product.status 不表达任何平台 Listing 状态。
```

### 5.2 ProductVariant

状态：

```text
draft
active
paused
archived
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | variant.create | draft | 创建 SKU |
| draft | variant.complete | active | 可用于 ListingDraftVariant |
| active | variant.pause | paused | 暂停新 Offer |
| paused | variant.resume | active | 恢复 |
| active / paused | variant.archive | archived | 终态 |

### 5.3 MediaAsset

状态：

```text
imported
processing
ready
failed
blocked
archived
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | media.import | imported | 创建资产 |
| none | media.generate | processing | AI 生成，必须创建 UsageRecord |
| imported / processing | media.ready | ready | 可生成平台 MediaVariant |
| processing | media.failed | failed | 记录失败原因 |
| ready | compliance.block | blocked | 禁止使用 |
| ready / failed / blocked | media.archive | archived | 终态 |

### 5.4 MediaVariant

状态：

```text
pending
generating
ready
invalid
archived
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| ready | variant.request | generating | 按平台规格生成 |
| generating | variant.ready | ready | 可被 ListingDraft 引用 |
| generating | variant.invalid | invalid | 规格不满足 |
| ready / invalid | variant.archive | archived | 终态 |

### 5.5 ContentDraft

状态：

```text
draft
generating
ready
waiting_approval
approved
rejected
superseded
archived
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | content.generate.start | generating | 创建 UsageRecord |
| generating | content.generate.success | ready | 生成候选内容 |
| generating | content.generate.failed | draft | 保留草稿上下文 |
| ready | content.submit_review | waiting_approval | 创建 ApprovalTask |
| waiting_approval | approval.approve | approved | 可被 ListingDraft 采纳 |
| waiting_approval | approval.reject | rejected | 保留原因 |
| approved | new_version.selected | superseded | 不再是当前采纳版本 |
| draft / ready / rejected / superseded | content.archive | archived | 终态 |

说明：

```text
ContentDraft 是内容候选；
ListingDraft 中保存被采纳后的提交快照；
两者通过 ListingDraftContentLink 关联。
```

## 6. 平台适配与发布状态机

### 6.1 PlatformFitAssessment

状态：

```text
not_started
running
completed
outdated
canceled
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | assessment.start | running | 校验类目、属性、合规、媒体、价格 |
| running | assessment.success | completed | 生成 Finding 和 result |
| running | assessment.cancel | canceled | 终态 |
| completed | product.updated | outdated | 需要重新评估 |
| completed | platform.rule.updated | outdated | 需要重新评估 |
| outdated | assessment.start | running | 重新评估 |

结果字段：

```text
fit
not_fit
needs_info
```

### 6.2 ListingDraft

状态：

```text
draft
ready_for_validation
validated
waiting_approval
approved
published_snapshot
archived
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | draft.create | draft | 创建 ListingDraft |
| draft | draft.update | draft | 可编辑内容、图片、变体 |
| draft | draft.submit_validation | ready_for_validation | 前置校验由 Job 执行 |
| ready_for_validation | validation.success | validated | 校验通过 |
| ready_for_validation | validation.failed | draft | 回到可编辑状态，保留 Finding |
| validated | draft.submit_approval | waiting_approval | 创建 ApprovalTask |
| waiting_approval | approval.approve | approved | 记录 ApprovalTask |
| waiting_approval | approval.reject | draft | 保留拒绝原因 |
| approved | draft.edit_requested | draft | 发布前允许修改草稿 |
| approved | publish.snapshot_created | published_snapshot | 创建 PublishJob |
| published_snapshot | new_draft.created | draft | 生成新的可编辑草稿 |
| draft / ready_for_validation / validated / waiting_approval | draft.archive | archived | 终态 |

说明：

```text
ListingDraft.status 不包含 platform_review、live、rejected。
平台真实状态由 Listing.core_status 表达。
```

### 6.3 ListingDraftVariant

状态：

```text
draft
validated
approved
submitted
live
rejected
inactive
archived
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | variant.create | draft | 关联 ProductVariant |
| draft | listing.validated | validated | 随 ListingDraft 校验 |
| validated | listing.approved | approved | 随 ListingDraft 审批 |
| approved | publish.submitted | submitted | 随 PublishJob 提交 |
| submitted | platform.live | live | 平台返回可售 |
| submitted | platform.rejected | rejected | 记录平台原因 |
| live | platform.inactive | inactive | 下架 / 停售 |
| draft / validated / approved / rejected / inactive | variant.archive | archived | 终态 |

说明：

```text
ListingDraftVariant.status 是平台 Offer 状态投影。
核心状态仍以 Listing.core_status 为主。
```

### 6.4 PublishJob

状态：

```text
queued
running
succeeded
failed
needs_manual_action
canceled
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | job.enqueue | queued | ListingDraft 必须已 approved |
| queued | job.start | running | 调用 Temu Adapter |
| running | platform.submit.success | succeeded | 创建 / 更新 Listing |
| running | platform.submit.failed | failed | 写入 ErrorCatalogEntry |
| failed | job.retry | queued | retryable = true 且未超过最大尝试 |
| failed | job.manual | needs_manual_action | retryable = false 或超过最大尝试 |
| queued / running | job.cancel | canceled | 不允许已成功任务取消 |

说明：

```text
PublishJob.status 是一次动作状态。
如果后续平台审核失败，不把 PublishJob 改成 failed；
应更新 Listing.core_status = rejected。
```

P0 动作边界：

```text
P0 只实现 action = create；
update / withdraw 在 Phase 4 前不实现。
```

如果后续实现：

```text
update 成功后同步 Listing 价格 / 库存 / 内容；
withdraw 成功后更新 Listing.core_status = inactive。
```

两者都不能把 PublishJob.status 当作 Listing 的长期状态。

### 6.5 Listing

状态：

```text
submitted
platform_review
live
rejected
inactive
archived
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | listing.created | submitted | PublishJob 成功后创建 |
| submitted | platform.review.start | platform_review | 平台进入审核 |
| platform_review | platform.approve | live | 商品可售 |
| platform_review | platform.reject | rejected | 保留平台原因 |
| live | platform.pause | inactive | 下架 / 停售 |
| inactive | platform.resume | live | 重新上架 |
| rejected / inactive | listing.archive | archived | 终态 |

人工降级入口：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | listing.import.live | live | origin = imported / manual_recovery；Guard：平台确认 Listing 存在且在售 |
| none | listing.import.review | platform_review | origin = imported / manual_recovery；Guard：平台确认 Listing 正在审核 |
| none | listing.import.rejected | rejected | origin = imported / manual_recovery；Guard：平台确认 Listing 被驳回 |
| none | listing.import.inactive | inactive | origin = imported / manual_recovery；Guard：平台确认 Listing 存在但已停售 |

人工降级必须记录：

```text
external_listing_id
platform_raw_status
imported_by
import_source_ref
AuditLog
```

状态映射：

```text
Platform Raw Status
→ ToneClaw Platform Status
→ core_status
```

### 6.6 状态职责示例

| 场景 | ListingDraft.status | PublishJob.status | Listing.core_status |
| --- | --- | --- | --- |
| 草稿还没校验 | draft | 不存在 | 不存在 |
| 校验通过待审批 | waiting_approval | 不存在 | 不存在 |
| 已审批待发布 | approved | queued | 不存在 |
| 提交成功 | published_snapshot | succeeded | submitted |
| 平台审核中 | published_snapshot | succeeded | platform_review |
| 平台审核通过 | published_snapshot | succeeded | live |
| 平台审核失败 | published_snapshot | succeeded | rejected |
| API 调用失败 | approved | failed | 不存在 |
| 需要人工处理 | approved | needs_manual_action | 不存在 |

## 7. 订单与履约状态机

### 7.1 Order

状态：

```text
created
paid
waiting_fulfillment
partially_shipped
shipped
delivered
canceled
closed
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | order.import | created | 平台返回订单 |
| created | payment.confirmed | paid | 平台返回已支付 |
| paid | fulfillment.required | waiting_fulfillment | 可创建履约任务 |
| waiting_fulfillment | fulfillment.partial | partially_shipped | 存在部分发货 |
| waiting_fulfillment / partially_shipped | fulfillment.complete | shipped | 所有明细发货 |
| shipped | delivery.confirmed | delivered | 平台返回签收 |
| created / paid / waiting_fulfillment | order.cancel | canceled | 平台允许取消 |
| delivered / canceled | settlement.closed | closed | 订单事实收口 |

说明：

```text
ToneClaw Order.status 是统一状态；
平台 raw_status 单独保存；
状态映射规则由 Temu Adapter 处理。
```

### 7.2 Fulfillment

状态：

```text
pending
stocking
ready_to_ship
shipped
in_transit
delivered
exception
canceled
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | fulfillment.create | pending | 从订单派生 |
| pending | stock.required | stocking | 需要备货 |
| stocking | stock.ready | ready_to_ship | 可发货 |
| ready_to_ship | shipment.created | shipped | 生成运单 |
| shipped | carrier.in_transit | in_transit | 有轨迹 |
| in_transit | carrier.delivered | delivered | 已签收 |
| pending / stocking / ready_to_ship / shipped / in_transit | fulfillment.exception | exception | 记录异常 |
| exception | issue.resolved | shipped / in_transit / delivered | 根据事实恢复 |
| pending / stocking / ready_to_ship | fulfillment.cancel | canceled | 允许取消 |

P0 约束：

```text
不自动发货；
不自动创建备货单；
不自动修改库存。
```

### 7.3 AfterSale

状态：

```text
opened
processing
approved
rejected
completed
canceled
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | after_sale.import | opened | 平台返回售后 |
| opened | platform.process | processing | 平台处理中 |
| processing | platform.approve | approved | 退款 / 退货通过 |
| processing | platform.reject | rejected | 平台拒绝 |
| approved | refund.completed | completed | 售后完成 |
| opened / processing | after_sale.cancel | canceled | 终态 |

P0 约束：

```text
只读展示；
不自动处理售后。
```

### 7.4 Settlement

状态：

```text
pending
processing
paid
failed
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | settlement.create | pending | 平台返回结算记录 |
| pending | platform.process | processing | 结算中 |
| processing | payout.success | paid | 回款完成 |
| processing | payout.failed | failed | 记录错误 |
| failed | settlement.recheck | processing | 重新确认 |

P0 约束：

```text
基础状态可见；
完整对账延后。
```

## 8. 商业化与治理状态机

### 8.1 Plan

状态：

```text
active
retired
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | plan.create | active | 定义功能、额度、价格 |
| active | plan.retire | retired | 不影响已有订阅 |

### 8.2 Subscription

状态：

```text
trial
active
past_due
expired
canceled
suspended
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | subscription.start_trial | trial | 有试用期 |
| trial | trial.converted | active | 开始正式订阅 |
| trial | trial.expired | expired | 降级 |
| none | subscription.start | active | 正式开通 |
| active | payment.failed | past_due | 宽限期内可读不可新增高消耗 |
| past_due | payment.success | active | 恢复 |
| past_due | grace_period.expired | expired | 降级 |
| active | subscription.cancel | canceled | 到期后降级 |
| active / past_due | admin.suspend | suspended | 禁止高消耗操作 |

### 8.3 Entitlement

状态：

```text
active
expired
disabled
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | entitlement.create | active | 来源 Plan / Subscription |
| active | subscription.expired | expired | 权益失效 |
| active | admin.disable | disabled | 显式禁用 |
| disabled | admin.enable | active | 恢复 |

### 8.4 UsageRecord

状态：

```text
recorded
succeeded
failed
refunded
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | ai.request.start | recorded | 记录场景、模型、关联对象 |
| recorded | ai.request.success | succeeded | 写入实际 Token |
| recorded | ai.request.failed | failed | 记录错误 |
| succeeded | billing.refund | refunded | 特殊补偿场景 |

说明：

```text
所有生成动作都必须创建 UsageRecord；
失败也要保留记录。
```

### 8.5 ApprovalTask

状态：

```text
pending
approved
rejected
expired
canceled
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | approval.create | pending | 目标对象进入等待审批 |
| pending | user.approve | approved | 允许下一步动作 |
| pending | user.reject | rejected | 保留原因 |
| pending | approval.expire | expired | 需要重新发起 |


## 9. 同步与错误状态机

### 9.1 SyncJob

状态：

```text
queued
running
succeeded
failed
needs_manual_action
canceled
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | sync.enqueue | queued | 指定 object_type 和 store_id |
| queued | sync.start | running | 调用 Adapter |
| running | sync.success | succeeded | 更新 last_synced_at |
| running | sync.failed | failed | 写入 ErrorCatalogEntry |
| failed | sync.retry | queued | retryable = true 且未超过上限 |
| failed | sync.manual | needs_manual_action | 无法自动恢复 |
| queued / running | sync.cancel | canceled | 终态 |

### 9.2 ErrorCatalogEntry

状态：

```text
active
deprecated
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | error.register | active | 可用于错误解释 |
| active | platform.api.changed | deprecated | 保留历史，新增解释 |

## 10. 洞察状态机

### 10.1 Insight

状态：

```text
draft
generating
published
dismissed
archived
```

转移：

| From | Event | To | Guard / Effect |
| --- | --- | --- | --- |
| none | insight.generate.start | generating | 可创建 UsageRecord |
| generating | insight.success | draft | 等待发布 |
| generating | insight.failed | draft | 保留错误 |
| draft | insight.publish | published | 展示给用户 |
| published | user.dismiss | dismissed | 不再提示 |
| published / dismissed | insight.archive | archived | 终态 |

## 11. P0 必须实现的状态机

### P0 主链路

```text
Store
PlatformCredential
StoreCapability
DataSource
Supplier
SourcingItem
SelectionDecision
Product
ProductVariant
MediaAsset
MediaVariant
ContentDraft
PlatformFitAssessment
ListingDraft
ListingDraftVariant
PublishJob
Listing
Order
Fulfillment
Subscription
UsageRecord
ApprovalTask
SyncJob
```

### P0 只读或最小实现

```text
AfterSale
Settlement
Plan
Entitlement
Insight
```

### P0 预留

```text
PurchaseOrder
InventoryLedger
MarketSignal
CompetitorSignal
AgentTask
SupplyOrder
```

## 12. 下一步文档

状态机冻结后，下一份应创建：

```text
docs/TEMU_ADAPTER_CONTRACT.md
```

重点定义：

```text
授权；
店铺信息；
类目；
属性；
平台能力；
Listing 发布；
Listing 状态；
订单同步；
履约同步；
错误码；
重试策略；
安全存储。
```
