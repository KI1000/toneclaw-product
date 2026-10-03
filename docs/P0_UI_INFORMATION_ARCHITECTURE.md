# ToneClaw P0 页面信息架构

> 记录时间：2026-10-03 22:43:38 CST
> 状态：M0 草案
> 文档定位：定义 P0 桌面端的页面清单、信息架构、关键操作和状态展示。
> 上游依据：`docs/CORE_MODEL.md`、`docs/STATE_MACHINES.md`、`docs/TEMU_ADAPTER_CONTRACT.md`

## 1. P0 UI 原则

### 1.1 产品身份

UI 必须呈现为 ToneClaw。

不向用户暴露：

```text
DSH；
DeepSeek Harness；
Session 内部机制；
Plugin 内部概念；
平台原始错误码。
```

### 1.2 P0 范围

P0 只支持：

```text
1 个 BusinessAccount；
1 个 User；
1 个 Temu Store；
核心经营闭环。
```

UI 数据模型仍按多店铺设计，但 P0 可以隐藏多店铺切换。

### 1.3 交互原则

1. 每个页面必须让用户知道当前对象状态；
2. 每个失败状态必须给出下一步；
3. 高风险动作必须二次确认；
4. AI 生成结果必须标记为草稿；
5. 平台能力不足时显示人工降级路径；
6. 不展示平台原始错误码，只展示用户可理解原因。

## 2. 导航结构

P0 左侧导航建议：

```text
Dashboard
Store
Sourcing
Selection
Products
Listings
Publish Jobs
Orders
Fulfillments
Usage
Billing
Settings
```

页面分组：

| 分组 | 页面 | P0 优先级 |
| --- | --- | --- |
| 总览 | Dashboard | P0 |
| 渠道 | Store | P0 |
| 货源 | Sourcing / Selection | P0 |
| 商品 | Products / Images / Contents | P0 |
| 发布 | Listings / Publish Jobs | P0 |
| 经营 | Orders / Fulfillments | P0 基础只读 |
| 商业 | Usage / Billing | P0 |
| 系统 | Settings / Audit Logs | P0 最小版 |

## 3. Dashboard

### 目的

让卖家快速看到经营健康度和待办事项。

### 主要模块

| 模块 | 数据 | 说明 |
| --- | --- | --- |
| 店铺健康 | Store.status、PlatformConnection.status、StoreCapability | 显示已连接 / 待授权 / 需重新授权 / 部分能力不可用 |
| 上架漏斗 | SourcingItem → Product → ListingDraft → Listing | 显示候选数、已创建商品数、草稿数、已提交数、在售数 |
| 待处理任务 | ApprovalTask、PublishJob、SyncJob | 显示待审批、发布失败、同步失败 |
| 最近订单 | Order | 显示最近订单数量和状态 |
| 异常提醒 | Fulfillment、SyncJob | 显示履约异常和同步失败 |
| AI 用量摘要 | UsageRecord | 显示本期用量和剩余额度 |

### 关键操作

```text
连接 Temu 店铺；
去处理审批；
重试失败任务；
导入货盘；
创建商品；
查看最近订单。
```

### 状态展示

| 状态 | UI 表达 |
| --- | --- |
| Store connected | 绿色：“已连接” |
| Store connecting | 黄色：“连接中” |
| Store expired | 红色：“需要重新授权” |
| Store degraded | 橙色：“连接异常” |
| PublishJob failed | 红色：“发布失败，查看原因” |
| PublishJob needs_manual_action | 橙色：“需要人工上架” |
| UsageRecord 超额 | 红色：“AI 额度已用尽” |

## 4. Store

### 目的

管理 Temu 店铺连接和平台能力。

### 信息结构

| 区块 | 字段 / 数据 |
| --- | --- |
| 店铺概览 | Store.name、external_store_id、region、business_mode、currency、timezone |
| 连接状态 | Store.status、PlatformConnection.status |
| 授权信息 | PlatformCredential.scopes、expires_at、last_verified_at |
| 平台能力 | StoreCapability 列表 |
| 同步状态 | last_synced_at、SyncJob 最近任务 |
| 风险提示 | 授权过期、能力缺失、同步失败 |

### 关键操作

```text
连接 Temu；
重新授权；
检查平台能力；
手动同步店铺信息；
断开连接；
查看连接历史。
```

### 平台能力展示

| capability_key | UI 文案 |
| --- | --- |
| store.read | 店铺信息读取 |
| category.read | 类目读取 |
| attribute.read | 属性读取 |
| listing.create | 自动上架 |
| listing.status.read | Listing 状态同步 |
| order.read | 订单同步 |
| fulfillment.read | 履约同步 |
| settlement.read | 结算同步 |

每个能力显示：

```text
API 可用；
人工降级；
暂不可用；
暂不支持；
未知。
```

## 5. Sourcing

### 目的

管理货盘来源和候选商品。

### 页面结构

#### 5.1 Sourcing Pool

| 区块 | 数据 |
| --- | --- |
| 来源筛选 | DataSource.type：manual / excel / csv / json |
| 商品筛选 | 类目、价格区间、MOQ、交期、库存状态、风险状态 |
| 商品列表 | SourcingItem.title、supplier、purchase_price、suggested_price、stock_status、risk_status |
| 批量操作 | 导入、导出、标记、归档 |

#### 5.2 Sourcing Item Detail

| 区块 | 数据 |
| --- | --- |
| 基础信息 | 标题、描述、品牌、类目候选 |
| 价格 | 采购价、建议售价、币种 |
| 供应链 | 供应商、MOQ、交期、库存状态 |
| 图片 | SourcingItemMedia |
| 资质 | SourcingItemQualification |
| 来源 | DataSource、SourceRecord |
| 选品历史 | SelectionDecision 列表 |

### 关键操作

```text
导入 Excel / CSV / JSON；
手工创建货盘商品；
编辑货盘字段；
上传货盘图片；
上传资质文件；
标记候选 / 拒绝 / 观察；
送入选品；
归档。
```

### 状态展示

| SourcingItem.status | UI 文案 |
| --- | --- |
| imported | 已导入 |
| normalizing | 标准化中 |
| candidate | 候选 |
| invalid | 数据不完整 |
| selected | 已选入商品池 |
| rejected | 已拒绝 |
| archived | 已归档 |

## 6. Selection

### 目的

判断货盘商品是否进入经营商品池。

### 页面结构

#### 6.1 Selection Queue

| 区块 | 数据 |
| --- | --- |
| 待决策列表 | SourcingItem.status = candidate |
| AI 建议 | 选品评分、理由、风险提示 |
| 基础指标 | 采购成本、建议售价、毛利空间、MOQ、交期 |
| 决策操作 | 通过 / 拒绝 / 观察 |

#### 6.2 Selection Detail

| 区块 | 数据 |
| --- | --- |
| 货盘详情 | SourcingItem |
| 图片 / 资质 | SourcingItemMedia / SourcingItemQualification |
| AI 分析 | 选品理由、风险、利润估算 |
| 决策表单 | decision、reason、scores |
| 历史决策 | SelectionDecision 历史 |

### 关键操作

```text
通过选品；
拒绝选品；
标记观察；
填写选品理由；
创建 Product；
重新评估。
```

### 状态展示

| SelectionDecision.decision | UI 文案 |
| --- | --- |
| approved | 已通过 |
| rejected | 已拒绝 |
| observing | 观察中 |

## 7. Products

### 目的

管理 ToneClaw 商品主数据。

### 页面结构

#### 7.1 Product List

| 区块 | 数据 |
| --- | --- |
| 商品列表 | Product.title、status、variant 数量、risk_status |
| 来源筛选 | 货盘来源、手工创建、AI 创建 |
| 状态筛选 | draft / active / paused / archived |
| 快捷入口 | 创建商品、生成 Listing |

#### 7.2 Product Detail

| 区块 | 数据 |
| --- | --- |
| 基本信息 | title、description、brand、core_category |
| 规格 | ProductVariant 列表 |
| 属性 | AttributeValue 列表 |
| 图片 | MediaAsset 列表 |
| 内容草稿 | ContentDraft 列表 |
| 平台适配 | PlatformFitAssessment |
| 来源追溯 | SourcingItem、SelectionDecision |

### 关键操作

```text
创建商品；
编辑商品；
新增 / 编辑 SKU；
上传图片；
生成图片；
生成标题 / 描述 / 卖点；
发起平台适配评估；
创建 Listing 草稿；
暂停 / 归档商品。
```

### 状态展示

| Product.status | UI 文案 |
| --- | --- |
| draft | 草稿 |
| active | 可经营 |
| paused | 已暂停 |
| archived | 已归档 |

## 8. Images

### 目的

管理商品图片和平台图片变体。

### 页面结构

| 区块 | 数据 |
| --- | --- |
| 原始图片 | MediaAsset 列表 |
| 图片详情 | media_type、source_type、storage_ref、checksum、rights_status |
| 平台变体 | MediaVariant 列表 |
| 生成任务 | 图片生成状态和 UsageRecord |

### 关键操作

```text
上传图片；
AI 生成主图；
AI 生成细节图；
AI 生成场景图；
生成 Temu 规格变体；
设置主图；
替换图片；
禁用侵权风险图片。
```

### 状态展示

| MediaAsset.status | UI 文案 |
| --- | --- |
| imported | 已导入 |
| processing | 处理中 |
| ready | 可用 |
| failed | 生成失败 |
| blocked | 已拦截 |
| archived | 已归档 |

## 9. Listings

### 目的

管理 Temu Listing 草稿和平台商品状态。

### 页面结构

#### 9.1 Listing List

| 区块 | 数据 |
| --- | --- |
| Listing 草稿 | ListingDraft.title、status、store、platform |
| 平台 Listing | Listing.external_listing_id、core_status、price、stock |
| 状态筛选 | draft / validated / waiting_approval / approved / published_snapshot |
| 平台状态筛选 | submitted / platform_review / live / rejected / inactive |
| 失败筛选 | PublishJob.failed、needs_manual_action |

#### 9.2 Listing Draft Detail

| 区块 | 数据 |
| --- | --- |
| 商品信息 | Product、ProductVariant |
| 平台标题 | ListingDraft.title |
| 平台描述 | ListingDraft.description |
| 卖点 | ListingDraft.bullets |
| 关键词 | ListingDraft.keywords |
| 类目 | PlatformCategoryMapping |
| 属性 | PlatformAttributeValue |
| 图片 | MediaVariant 列表 |
| SKU / Offer | ListingDraftVariant 列表 |
| 校验结果 | Finding 列表 |
| 内容追溯 | ListingDraftContentLink |
| 平台适配 | PlatformFitAssessment |
| 审批 | ApprovalTask |

#### 9.3 Listing Platform Detail

| 区块 | 数据 |
| --- | --- |
| 平台链接 | Listing.url |
| 平台 ID | external_listing_id |
| 核心状态 | core_status |
| 平台原始状态 | raw_status |
| 当前价格 | price_minor / currency |
| 当前库存 | stock_qty |
| 最近同步 | last_synced_at |

### 关键操作

```text
创建 Listing 草稿；
编辑 Listing；
运行校验；
提交审批；
审批通过；
审批拒绝；
创建上架任务；
生成人工上架包；
导入人工上架结果；
查看平台状态；
归档草稿。
```

### 状态展示

| ListingDraft.status | UI 文案 |
| --- | --- |
| draft | 草稿 |
| ready_for_validation | 待校验 |
| validated | 校验通过 |
| waiting_approval | 待审批 |
| approved | 已审批 |
| published_snapshot | 已提交发布 |
| archived | 已归档 |

| Listing.core_status | UI 文案 |
| --- | --- |
| submitted | 已提交 |
| platform_review | 平台审核中 |
| live | 在售 |
| rejected | 平台驳回 |
| inactive | 已下架 |
| archived | 已归档 |

## 10. Publish Jobs

### 目的

追踪平台上架任务和人工降级任务。

### 页面结构

| 区块 | 数据 |
| --- | --- |
| 任务列表 | PublishJob.status、action、store、listing_draft |
| 失败原因 | ErrorCatalogEntry.user_message、remediation |
| 重试信息 | attempt_count、max_attempt_count |
| 人工任务 | 导出包状态、导入结果 |
| 审计 | AuditLog |

### 关键操作

```text
重试失败任务；
取消排队任务；
下载人工上架包；
导入人工上架结果；
查看错误详情；
查看审计记录。
```

### 状态展示

| PublishJob.status | UI 文案 |
| --- | --- |
| queued | 排队中 |
| running | 执行中 |
| succeeded | 成功 |
| failed | 失败 |
| needs_manual_action | 需要人工上架 |
| canceled | 已取消 |

## 11. Orders

### 目的

让卖家查看 Temu 订单基础状态。

### 页面结构

| 区块 | 数据 |
| --- | --- |
| 订单列表 | Order.order_number、status、total、placed_at |
| 订单筛选 | 状态、时间、店铺、SKU |
| 订单明细 | OrderItem |
| 同步状态 | last_synced_at、SyncJob |

### 关键操作

```text
查看订单；
查看订单明细；
手动同步订单；
跳转履约。
```

### 状态展示

| Order.status | UI 文案 |
| --- | --- |
| created | 已创建 |
| paid | 已付款 |
| waiting_fulfillment | 待履约 |
| partially_shipped | 部分发货 |
| shipped | 已发货 |
| delivered | 已签收 |
| canceled | 已取消 |
| closed | 已关闭 |

## 12. Fulfillments

### 目的

查看履约 / 发货状态和异常。

### 页面结构

| 区块 | 数据 |
| --- | --- |
| 履约列表 | Fulfillment.status、carrier、tracking_number |
| 异常列表 | exception_reason |
| 关联订单 | Order |
| 同步状态 | last_synced_at、SyncJob |

### 关键操作

```text
查看履约；
查看物流轨迹入口；
手动同步履约；
标记已了解异常。
```

P0 不做自动发货。

## 13. Usage

### 目的

展示 AI / Token 用量和剩余额度。

### 页面结构

| 区块 | 数据 |
| --- | --- |
| 本期额度 | Plan.token_quota、已用、剩余 |
| 用量趋势 | 按日 / 按场景 |
| 明细 | UsageRecord 列表 |
| 成本估算 | cost_estimate_minor |
| 异常记录 | failed UsageRecord |

### 关键操作

```text
按场景筛选；
按时间筛选；
查看某次生成的关联对象；
导出用量明细。
```

## 14. Billing

### 目的

管理订阅、套餐和功能权益。

### 页面结构

| 区块 | 数据 |
| --- | --- |
| 当前套餐 | Plan.name、price、billing_period |
| 订阅状态 | Subscription.status、starts_at、ends_at |
| 功能权益 | Entitlement 列表 |
| 额度 | Token、商品数、店铺数 |
| 变更记录 | 订阅变更历史 |

### 关键操作

```text
查看当前套餐；
查看权益；
续费入口；
升级套餐入口；
查看到期时间。
```

P0 不要求完整支付后台。

## 15. Settings

### 目的

管理账号、偏好、安全和系统配置。

### 页面结构

| 区块 | 数据 |
| --- | --- |
| 经营主体 | BusinessAccount.name |
| 用户 | User 主账号信息 |
| 界面语言 | locale |
| 安全 | 登录状态、设备信息 |
| 平台连接 | 跳转 Store 页 |
| 通知偏好 | 飞书通知开关 |
| 审计 | AuditLog 入口 |

### 关键操作

```text
编辑经营主体名称；
编辑用户信息；
切换语言；
配置飞书通知；
查看审计日志；
退出登录。
```

## 16. 跨页面状态与提示

### 16.1 全局提示

| 状态 | 全局提示 |
| --- | --- |
| PlatformConnection expired | “Temu 授权已过期，请重新连接。” |
| Store degraded | “店铺连接异常，同步可能延迟。” |
| listing.create unavailable | “当前平台能力不足，请使用人工上架包。” |
| Token 超额 | “AI 额度已用完，请升级套餐或等待下期。” |
| SyncJob repeated failure | “同步失败，请查看任务中心。” |

### 16.2 AI 草稿规则

AI 生成的标题、描述、卖点、图片必须显示：

```text
AI 草稿
```

并且必须经过：

```text
预览
→ 编辑 / 确认
→ 审批
→ 采纳
```

### 16.3 平台能力不足规则

当 `listing.create` 不可用时，Publish Jobs 页面显示：

```text
需要人工上架
```

并提供：

```text
下载上架包；
复制资料；
回填平台 Listing ID；
导入平台状态。
```

## 17. P0 不做的 UI

```text
多店铺切换；
团队成员管理；
复杂角色权限；
广告管理；
客服工作台；
智能选品大盘；
高级财务报表；
AI Agent 自动执行面板；
多语言站点切换；
移动端。
```

## 18. 冻结标准

本文件冻结前应确认：

1. 页面清单覆盖 P0 主链路；
2. 每个页面都有明确目的和数据；
3. 高风险操作都有确认机制；
4. AI 生成内容都能追溯到草稿和用量；
5. 平台能力不足时有人工降级入口；
6. 用户不接触 DSH 和平台原始错误码；
7. 不做超出 P0 的 UI 功能。
