# ToneClaw 业务架构与分阶段实施路线图

> 记录时间：2026-10-03 20:52:23 CST  
> 状态：当前总体架构与实施路线图
> 上游依据：
> - `docs/BUSINESS_ARCHITECTURE.md`：业务架构 SSOT
> - `docs/PRODUCT_PLAN_REVIEW.md`：P0 产品规划 SSOT

## 1. 总判断

当前应该进入一个新阶段：

```text
从“确认业务方向”
→ 到“冻结总体业务架构”
→ 到“分阶段垂直实施”
→ 到“用真实经营闭环校准产品”
```

但这不等于一次性设计一个无所不包的大平台。

更准确的策略是：

```text
先把核心业务模型设计稳；
再把 Temu 做成第一层可运营闭环；
再把平台无关能力逐步复用到其他平台；
最后让 AI 从 Copilot 演进成可控的 Agent。
```

一句话定位：

> ToneClaw 是 AI-native 跨境卖家经营系统，不是普通 AI Listing 工具，也不是一开始就要替代完整 ERP。

## 2. 产品愿景

ToneClaw 要服务的是跨境电商卖家的完整经营过程：

```text
找货
→ 选品
→ 商品准备
→ 商品图
→ Listing
→ 上架
→ 订单
→ 履约
→ 售后
→ 结算
→ 利润
→ 复盘
→ 再选品 / 再补货 / 再调价
```

长期目标是成为：

```text
AI-native 跨境卖家经营系统
```

第一版服务对象：

```text
一人 OPC 卖家
+ 小团队卖家
+ 优先验证 Temu 平台
```

## 3. 总体业务架构模型

### 3.1 核心分层

```text
入口层
├── ToneClaw 桌面端
├── 飞书：通知 / 远程控制
└── 后续 Web / Mobile

ToneClaw 产品层
├── 卖家与店铺
├── 货盘
├── 选品
├── 商品主数据
├── 商品图与内容
├── Listing
├── 上架
├── 订单 / 履约
├── 结算 / 利润
├── 经营复盘
├── 软件计费
└── Token 计费

平台与外部系统接入层
├── Temu Adapter：P0
├── TikTok Shop Adapter：后续
├── Amazon Adapter：后续
├── 货盘 / 供应商数据源
└── ERP / WMS：后续

DSH 引擎层
├── Agent / Session
├── Tool Runtime
├── Workspace
├── Permission
├── Job / Schedule
└── Plugin Composition
```

### 3.2 核心对象模型

| 对象 | 层级 | 说明 |
| --- | --- | --- |
| Seller | 跨平台层 | 卖家身份，P0 可先单租户 / 单卖家 |
| Store | 平台层 | 平台店铺、授权、经营模式 |
| PlatformCredential | 平台层 | 平台授权凭据 |
| Supplier | 跨平台层 | 供应商、货源、资质、起订量、供货能力 |
| SourcingItem | 跨平台层 | 平台无关货盘商品 / 选品候选 |
| SelectionDecision | 跨平台层 | 平台无关选品结论 |
| PlatformFitAssessment | 平台层 | 平台适配评估结论 |
| Product | 跨平台层 | ToneClaw 内经营商品 |
| ProductVariant | 跨平台层 | SKU / 规格 |
| MediaAsset | 跨平台层 | 图片、视频、素材资产 |
| ContentDraft | 跨平台层 | 标题、卖点、描述、关键词等内容草稿 |
| ListingDraft | 平台层 | 平台 Listing 草稿 |
| PublishJob | 平台层 | 上架任务 |
| Listing | 平台层 | 平台侧商品链接 |
| Order | 平台层 | 平台订单 |
| Fulfillment | 平台层 | 发货 / 履约 |
| AfterSale | 平台层 | 售后 / 退款 / 评价 |
| Settlement | 平台层 | 平台结算 / 回款 |
| CostProfit | 跨平台层 | 成本、费用、利润 |
| Subscription | 商业层 | 软件订阅 / 授权 |
| UsageRecord | 商业层 | AI / Token 用量 |
| AuditLog | 横切层 | 操作审计 |
| Insight | 经营层 | 日报、异常、建议 |

### 3.3 核心数据关系

最重要的关系是：

```text
Supplier
→ SourcingItem
→ SelectionDecision
→ Product
→ PlatformFitAssessment
→ ListingDraft
→ PublishJob
→ Listing
→ Order
→ Fulfillment
→ Settlement
→ CostProfit
→ Insight
```

其中：

```text
货盘 / 选品 / 商品 / 成本利润：跨平台共享
类目 / 属性 / 图片 / Listing / 订单 / 履约：平台适配
```

这保证同一个货盘商品未来可以复用到多个平台，而不是被 Temu 绑死。

## 4. 架构设计原则

### 4.1 跨平台能力和平台适配分离

跨平台能力：

- 货盘；
- 供应商；
- 选品；
- 商品主数据；
- 成本利润；
- AI 用量；
- 审计。

平台适配能力：

- 类目；
- 属性；
- 图片规格；
- Listing；
- 发布；
- 订单；
- 履约；
- 结算规则；
- 平台审核规则；
- 平台错误码。

### 4.2 平台字段不得污染核心模型

不允许出现：

```text
Product.temuTitle
Product.temuCategory
Product.temuQualification
```

应该使用：

```text
PlatformFitAssessment
ListingDraft
PlatformAttributeMapping
PlatformCategoryMapping
PlatformComplianceRule
```

### 4.3 所有主链路对象必须有状态机

至少覆盖：

- SourcingItem；
- SelectionDecision；
- Product；
- ContentDraft；
- ListingDraft；
- PublishJob；
- Order；
- Fulfillment；
- AfterSale；
- Settlement；
- Subscription；
- UsageRecord。

没有状态的对象不能成为主链路对象。

### 4.4 人工确认是产品能力，不是临时兜底

高风险动作必须进入系统状态：

- 上架；
- 改价；
- 改库存；
- 创建备货单；
- 发货；
- 高成本 AI 生成。

人工确认后仍然要有：

- 审计；
- 状态回写；
- 失败原因；
- 下一步动作。

### 4.5 AI 动作必须可计量、可审计

所有 AI 生成动作都应该产生：

```text
UsageRecord
→ Scene
→ Model
→ InputTokens
→ OutputTokens
→ CostEstimate
→ Quota
→ AuditLog
```

### 4.6 官方 API 优先，能力不足显式降级

平台接入只走官方授权。

如果平台能力不足，必须显式降级：

```text
系统生成草稿
→ 导出资料
→ 卖家人工操作
→ 结果导入
→ 状态回写
→ 审计留痕
```

不能伪装成自动完成。

### 4.7 每个阶段都要闭环

不做纯地基式开发。

每个阶段都应该能被真实用户感知或被真实业务数据验证。

## 5. 业界对标与当前差距

| 领域 | 业界成熟做法 | 当前模型评价 |
| --- | --- | --- |
| 货盘 / PIM | Master Catalog + Supplier Catalog + Attribute Model | 方向正确，但需补完整字段和来源生态 |
| 选品 | 市场数据 + 竞品数据 + 利润模型 + 风险模型 | 当前抽象好，但数据源不足 |
| 渠道分发 | Platform Adapter + Category Mapping + Attribute Mapping + Publish Job | 模型正确，P0 只落 Temu |
| AI 内容 | Listing / 图片 / 翻译 / 优化 | 已规划，但需增加质量评估和成本控制 |
| 订单库存 | ERP / WMS / 多仓 / 多币种 | P0 只做基础可见，正确 |
| 经营分析 | 漏斗 + 异常 + 利润 + 复盘 | 已规划，需逐步数据化 |
| AI Agent | 可控任务编排 + 审计 + 权限 + 评估 | 长期方向，P0 不追求全自动 |

当前最大短板不是架构思想，而是：

```text
真实数据源
+ 平台 API 能力
+ 类目 / 属性库
+ 稳定履约链路
+ AI 成本控制
```

## 6. 分阶段实施路线

### Phase 0：架构与领域模型冻结

目标：

> 建立长期可扩展的业务骨架，同时避免过度抽象。

交付：

1. 核心对象字典；
2. 主链路状态机；
3. Temu Adapter 边界；
4. Platform Fit 模型；
5. 权限与审计模型；
6. 软件计费模型；
7. Token 计量模型；
8. 关键页面信息架构；
9. 最小商品字段清单；
10. 最小货盘字段清单；
11. 最低验收标准。

完成标准：

```text
开发不再根据模糊想象实现功能，
而是按照对象、状态、权限、审计和验收标准实现。
```

### Phase 1：ToneClaw × Temu 最小闭环

目标：

> 完成第一条真实可运营链路。

范围：

```text
Temu 店铺接入
→ 货盘导入
→ 选品
→ Temu 适配评估
→ 商品图
→ Listing
→ 上架 / 草稿
→ 状态回写
→ 订单 / 履约可见
→ 软件计费
→ Token 计费
```

验收核心：

1. 用户看到的是 ToneClaw；
2. 可以连接一个真实 Temu 店铺；
3. 可以从货盘选择商品；
4. 可以生成商品图和 Listing；
5. 可以生成上架任务或明确人工处理任务；
6. 状态不丢失；
7. AI 用量可追踪；
8. 软件授权生效；
9. 失败有原因；
10. 单人卖家可以独立使用。

### Phase 2：真实店铺试点与工程加固

目标：

> 从“能跑通”变成“可稳定使用”。

重点：

- 真实店铺试点；
- 平台错误码治理；
- 重试机制；
- 数据一致性；
- 同步监控；
- 权限收紧；
- 审计完善；
- 图片 / Listing 质量优化；
- 上架审核通过率提升；
- 异常提醒优化。

完成标准：

```text
系统不再只适合演示，
而是一个卖家可以连续使用的经营工具。
```

### Phase 3：商业化收口

目标：

> 让产品可售卖、可续费、可控制成本。

范围：

- 套餐；
- 授权；
- 试用；
- 到期降级；
- Token 配额；
- 高成本操作确认；
- 用量报表；
- 订阅变更记录；
- 支付 / 收款链路。

完成标准：

```text
可以清楚回答：谁买了什么，能用什么，用了多少，剩多少，还能不能用。
```

### Phase 4：商品主数据与多平台扩展

目标：

> 把 P0 中被 Temu 验证过的模型，抽象成真正的多平台基础能力。

范围：

- Category Mapping；
- Attribute Mapping；
- Media Variant；
- Content Version；
- Compliance Rule；
- Platform Fit；
- 第二平台 Adapter；
- 多店铺基础能力。

候选平台：

- TikTok Shop；
- Amazon；
- Shopee；
- AliExpress；
- 独立站。

选择标准：

1. 官方 API 成熟度；
2. 用户需求强度；
3. 资质门槛；
4. 与现有模型复用度；
5. 单人团队可维护性。

### Phase 5：数据驱动选品

目标：

> 从“可配置筛选 + AI 建议”升级为真正的数据驱动选品。

能力：

- 平台热销数据；
- 类目趋势；
- 价格带；
- 竞品数量；
- 关键词需求；
- 评价分析；
- 物流成本模拟；
- 利润模拟；
- 风险信号；
- 供应商稳定度；
- AI 选品解释。

完成标准：

```text
选品建议可以被数据解释，而不是只有 AI 模板。
```

### Phase 6：ERP-lite 经营闭环

目标：

> 补齐订单之后的关键经营链路，但不做巨型 ERP。

范围：

- 采购；
- 库存；
- 仓储；
- 物流；
- 面单；
- 售后；
- 退款；
- 回款；
- 多币种基础对账；
- 成本利润精细化。

完成标准：

```text
卖家可以看清一笔商品从采购到回款的真实利润。
```

### Phase 7：AI Agent 经营自动化

目标：

> 从 Copilot 演进为可控 Agent。

能力：

- 任务编排；
- 自动调研；
- 自动内容生成；
- 自动异常处理建议；
- 自动补货建议；
- 自动定价建议；
- 自动日报；
- 高风险动作人工确认；
- 全量审计；
- 效果评估；
- 成本控制。

完成标准：

```text
AI 能完成低风险重复工作；
高风险动作仍由卖家确认；
每个动作可追踪、可解释、可审计。
```

## 7. 推荐执行顺序

```text
Phase 0：架构与领域模型冻结
↓
Phase 1：ToneClaw × Temu 最小闭环
↓
Phase 2：真实店铺试点与工程加固
↓
Phase 3：商业化收口
↓
Phase 4：商品主数据与多平台扩展
↓
Phase 5：数据驱动选品
↓
Phase 6：ERP-lite 经营闭环
↓
Phase 7：AI Agent 经营自动化
```

不要这样做：

```text
先做全量 PIM
→ 再做多平台
→ 再做 AI
→ 最后才发现核心闭环不可用
```

也不要这样做：

```text
先堆 AI 功能
→ 再补业务对象
→ 最后系统无法追踪状态和利润
```

## 8. “最佳产品”的定义

最佳产品不是功能最多，而是：

1. 单人卖家能独立完成核心经营；
2. 关键业务状态不丢失；
3. AI 结果可确认、可解释、可审计；
4. 平台规则不伪装；
5. 上架审核通过率可提升；
6. 成本和利润看得清；
7. 货盘和选品能跨平台复用；
8. 后续平台接入成本可控；
9. AI 成本可控；
10. 用户不需要理解 DSH。

## 9. 核心指标

| 阶段 | 关键指标 |
| --- | --- |
| Phase 1 | 能完成货盘到上架链路 |
| Phase 2 | 上架提交成功率、审核通过率、异常处理耗时 |
| Phase 3 | 订阅转化、Token 成本、单商品 AI 成本 |
| Phase 4 | 新平台接入成本、核心对象复用率 |
| Phase 5 | 选品建议采纳率、选品后出单率 |
| Phase 6 | 利润准确度、库存准确度、履约异常率 |
| Phase 7 | 自动任务完成率、人工确认率、异常率 |

## 10. 当前下一步

接下来应先完成：

1. 核心对象字典；
2. 主链路状态机；
3. Temu Adapter 契约；
4. 货盘最小字段；
5. 商品最小字段；
6. Listing 最小字段；
7. 软件计费模型；
8. Token 计量模型；
9. 权限与审计模型；
10. P0 页面信息架构。

这一步完成前，不建议大规模写业务代码。

## 11. 业界对标与规划映射

### 11.1 业界总体画像

业界成熟系统通常由几类能力组成：

```text
Master Catalog / PIM
+ Supplier Catalog / 货盘生态
+ Product Research / 选品情报
+ Channel Manager / Platform Adapter
+ AI Content / AI Listing
+ Order / Inventory / Fulfillment / ERP
+ Finance / Settlement / Profit
+ AI Usage Metering
+ AI Agent / Agentic Commerce
```

ToneClaw 不打算第一版复刻全部能力，而是先把平台无关核心模型和 Temu 单平台闭环跑通，再分阶段吸收业界成熟能力。

### 11.2 业界能力与规划映射

| 业界能力 | ToneClaw 对应对象 / 概念 | 当前规划阶段 | 是否进入 P0 |
| --- | --- | --- | --- |
| Master Catalog / PIM | Product、ProductVariant、MediaAsset、ContentDraft | Phase 0 做最小模型；Phase 4 做完整 PIM | 最小版进入 P0 |
| 货盘 / Supplier Catalog | Supplier、SourcingItem | Phase 0 定义模型；Phase 1 做结构化导入 | 进入 P0 |
| 供应商生态接入 | DataSource、SupplierCatalogFeed、SourcingItem | Phase 0 预留；后续接 1688 / CJ / Doba / 本土货盘等 | 不做完整生态，只做导入 |
| 平台无关选品 | SelectionDecision、选品理由、利润空间、风险提示 | Phase 0 定义；Phase 1 人工确认 | 进入 P0 |
| 市场情报 / 竞品分析 | MarketSignal、CompetitorSignal、DemandSignal | Phase 5 | 不进入 P0 |
| 平台渠道分发 | Store、PlatformCredential、PlatformFitAssessment、ListingDraft、PublishJob、Listing | Phase 1 先做 Temu；Phase 4 多平台 | Temu 进入 P0 |
| 类目映射 | PlatformCategoryMapping、CategoryTree | Phase 0 做最小映射；Phase 4 做完整体系 | 最小版进入 P0 |
| 属性映射 | PlatformAttributeMapping、AttributeSchema | Phase 0 做最小映射；Phase 4 完整建模 | 最小版进入 P0 |
| 商品图 / AI 内容 | MediaAsset、ImageVariant、ContentDraft、ContentVersion | Phase 1 / M3 | 进入 P0 |
| AI Listing 优化 | ListingDraft、ContentVersion、UsageRecord | Phase 1 / M3 | 进入 P0 |
| AI Agent / Agentic Commerce | AgentTask、ToolPolicy、EvaluationRun、AuditLog | Phase 7 | 不进入 P0 |
| AI 购物代理数据就绪 | 结构化属性、GTIN、Schema、库存新鲜度、价格一致性 | Phase 4 起，不提前追求 | 不进入 P0 |
| 订单同步 | Order、OrderItem、OrderStatus | Phase 1 基础同步；Phase 6 深化 | 基础版进入 P0 |
| 履约 / 发货 | Fulfillment、Shipment、FulfillmentStatus | Phase 1 基础可见；Phase 6 深化 | 基础版进入 P0 |
| 售后 / 退款 | AfterSale、Refund、Dispute | Phase 6 | 不进入 P0 |
| 库存 / 仓库 / 采购 | Stock、Warehouse、PurchaseOrder | Phase 6 / ERP-lite | 不进入 P0 |
| 结算 / 回款 | Settlement、PlatformFee、Payout | Phase 1 基础模型；Phase 6 完整对账 | 基础版进入 P0 |
| 利润核算 | CostProfit、CurrencyRate、FeeRule | Phase 1 基础估算；Phase 6 精细核算 | 基础版进入 P0 |
| 软件计费 | Subscription、Plan、Entitlement、LicenseStatus | Phase 0 建模；Phase 1 校验；Phase 3 商业化 | 进入 P0 |
| Token / AI 用量计费 | UsageRecord、Quota、PlanLimit、CostEstimate | Phase 0 建模；Phase 1 记录；Phase 3 完整计费 | 进入 P0 |
| 审计 / 权限 | AuditLog、Permission、ApprovalTask | Phase 0 | 进入 P0 |
| 可观测性 / 同步稳定性 | SyncJob、IntegrationEvent、RetryPolicy、ErrorCatalog | Phase 2 | 不作为 P0 主功能 |
| 多店铺 | Store、StoreGroup | Phase 4 | 不进入 P0 |
| 多币种 / 税务 | CurrencyRate、TaxRule、CountryRule | Phase 4 / Phase 6 | 不进入 P0 |
| 完整 ERP / WMS | PurchaseOrder、Warehouse、Shipment、InventoryLedger | Phase 6 | 不进入 P0 |

### 11.3 P0 中的业界能力取舍

P0 只保留支撑第一条闭环的能力：

```text
Temu 店铺接入
→ 最小货盘模型
→ 平台无关选品
→ Temu 平台适配
→ 商品图 / Listing
→ 上架任务
→ 状态回写
→ 基础订单 / 履约可见
→ 软件授权
→ Token 计量
```

以下能力明确延后：

```text
完整 PIM
供应商生态 API
市场情报订阅
竞品数据源
多平台店铺
复杂库存 / 采购 / WMS
完整财务对账
AI Agent 自动执行
```

### 11.4 M0 需要预留的业界标准对象

这些对象不需要 P0 完整实现，但 M0 必须在领域模型中预留，否则后续扩展会破坏核心模型：

| 对象 | 预留原因 |
| --- | --- |
| DataSource | 后续接入供应商生态和市场数据源 |
| MarketSignal | 后续支持数据驱动选品 |
| CompetitorSignal | 后续支持竞品分析 |
| DemandSignal | 后续支持需求预测和选品评分 |
| RiskSignal | 后续支持禁售、知识产权、认证、合规风险 |
| CategoryTree | 统一类目树，避免被单一平台类目绑定 |
| AttributeSchema | 统一属性模型，避免平台字段污染核心商品 |
| PlatformCategoryMapping | 平台类目映射 |
| PlatformAttributeMapping | 平台属性映射 |
| ComplianceRequirement | 平台合规、资质、禁售规则 |
| ContentVersion | 内容版本、审核结果和回滚 |
| SyncJob | 平台同步任务、重试和状态追踪 |
| IntegrationEvent | 外部系统事件和回调 |
| RetryPolicy | 平台调用失败后的重试策略 |
| ErrorCatalog | 平台错误码和用户可理解原因 |

### 11.5 规划原则

业界能力不是照单全收，而是按四类处理：

```text
P0 必做：支撑第一条闭环
P0 预留：建模但不完整实现
后续阶段：有真实业务价值后再做
明确延后：避免过早复杂化
```

## 12. 阶段衔接与重构风险控制

### 12.1 总原则

阶段之间应该是扩展关系，不是推倒重来。

```text
上一阶段交付可运行能力；
下一阶段复用核心对象和状态机；
新增能力通过 Adapter、Mapping、Job、Policy 扩展；
不允许把平台逻辑写进核心域。
```

### 12.2 阶段门禁

每个阶段结束前必须通过对应门禁，避免小问题积累成 Phase 4 大重构。

| 门禁 | 所属阶段 | 必须通过的条件 |
| --- | --- | --- |
| G0 | Phase 0 架构冻结 | 核心对象、状态机、Adapter 契约、权限审计、计费计量模型已冻结 |
| G1 | Phase 1 最小闭环 | Temu 链路可运行，核心模型没有 Temu 专属字段，AI 动作有 UsageRecord |
| G2 | Phase 2 真实试点 | 错误码、重试、同步、审计、数据一致性达到可用标准 |
| G3 | Phase 3 商业化 | 套餐、授权、配额、用量、降级策略闭环 |
| G4 | Phase 4 多平台扩展 | 核心模型通过跨平台审查，第二平台只通过 Adapter 接入 |
| G5 | Phase 5 数据驱动选品 | SelectionDecision 保持平台无关，平台差异仍在适配评估层 |
| G6 | Phase 6 ERP-lite | 库存、采购、履约、结算和利润对象能对齐，不污染跨平台核心 |
| G7 | Phase 7 AI Agent | 自动任务具备权限、审计、确认、回滚和评估机制 |

### 12.3 Phase 0 调整

原 Phase 0 调整为两个子阶段。

#### Phase 0A：业务模型冻结

冻结以下核心对象：

```text
Seller / Store
Supplier / SourcingItem
SelectionDecision
Product / ProductVariant
PlatformFitAssessment
ListingDraft / PublishJob / Listing
Order / Fulfillment
Settlement / CostProfit
Subscription / UsageRecord
AuditLog / Insight
```

#### Phase 0B：工程契约冻结

冻结以下工程契约：

```text
Platform Adapter Interface
统一状态映射
错误码 / ErrorCatalog
同步任务 / SyncJob
重试策略 / RetryPolicy
权限模型
审计模型
软件计费模型
Token 计量模型
领域事件边界
```

### 12.4 Phase 1 出口审查

Phase 1 结束时必须做一次“防平台硬编码审查”。

重点检查：

```text
核心对象是否被 Temu 字段污染；
Temu API 是否只出现在 Temu Adapter；
Temu 状态是否已映射为统一状态；
Temu 错误是否被 ErrorCatalog 转换；
选品是否被 Temu 绑定；
AI 生成是否全部产生 UsageRecord；
高风险写操作是否有确认和审计。
```

### 12.5 Phase 4 拆分

原 Phase 4 拆成两个子阶段。

#### Phase 4A：商品主数据与平台映射抽象

只做抽象和映射能力，不急着接第二平台。

范围：

```text
CategoryTree
AttributeSchema
PlatformCategoryMapping
PlatformAttributeMapping
ComplianceRequirement
MediaVariant
ContentVersion
PlatformCapabilityRegistry
```

#### Phase 4B：第二平台接入

只有 Phase 4A 通过审查后，才接入第二平台。

候选平台：

```text
TikTok Shop
Amazon
Shopee
AliExpress
```

选择标准：

```text
官方 API 成熟度
目标用户需求
资质门槛
模型复用度
单人团队维护成本
```

### 12.6 允许的渐进重构

以下属于健康重构：

```text
临时 API 调用改为标准 SyncJob；
散落错误提示集中到 ErrorCatalog；
硬编码校验改为规则模型；
局部服务拆成正式模块；
最小字段扩展为完整 PIM；
简单权限扩展为多店铺权限。
```

### 12.7 禁止的危险信号

如果出现以下信号，必须先停止新增功能：

```text
Product 出现 temu_title；
SourcingItem 出现 temu_category_id；
核心服务直接 import Temu SDK；
每个平台复制一套业务逻辑；
订单状态直接保存平台原始状态；
Token 用量后补；
权限审计后补；
前端直接解释平台错误码；
没有统一 PublishJob。
```
