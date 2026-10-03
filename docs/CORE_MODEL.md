# ToneClaw M0 核心模型

> 记录时间：2026-10-03 21:31:20 CST  
> 状态：M0 草案  
> 文档定位：定义 ToneClaw 的核心业务对象、关系、最小字段和 P0 边界。  
> 上游依据：  
> - `docs/BUSINESS_ARCHITECTURE.md`  
> - `docs/PRODUCT_PLAN_REVIEW.md`  
> - `docs/ARCHITECTURE_ROADMAP.md`  
> - `docs/INTEGRATION_MAP.md`

## 1. M0 目标

本文档不定义数据库 DDL，也不定义 API 细节。

本文档目标是冻结：

```text
核心业务对象是什么；
对象之间是什么关系；
每个对象解决什么问题；
哪些对象属于跨平台核心层；
哪些对象属于平台适配层；
P0 需要哪些最小字段；
哪些对象只预留，不在 P0 完整实现。
```

## 2. 基本约定

### 2.1 标识

所有业务对象使用系统内部 `id`，不使用平台原始 ID 作为主键。

```text
id: UUID / ULID
```

平台原始 ID 只作为外部引用保存，例如：

```text
external_store_id
external_listing_id
external_order_id
```

### 2.2 归属

P0 使用单卖家 / 单租户模型。

大多数对象应携带：

```text
business_account_id
```

平台相关对象还应携带：

```text
store_id
platform
```

### 2.3 时间

系统存储使用 UTC 时间。

```text
created_at
updated_at
```

展示层根据用户或店铺时区转换。

### 2.4 金额

金额不使用浮点数表示业务账务值。

建议使用：

```text
amount_minor: integer
currency: string
```

例如：

```text
amount_minor = 1250
currency = USD
```

表示 `12.50 USD`。

### 2.5 平台字段边界

禁止在核心对象上出现平台专属字段，例如：

```text
Product.temu_title
Product.temu_category_id
Product.temu_status
```

平台差异应放入：

```text
PlatformFitAssessment
PlatformCategoryMapping
PlatformAttributeMapping
ListingDraft
Listing
Order
Fulfillment
```

### 2.6 平台枚举

P0 只实现：

```text
temu
```

预留：

```text
tiktok_shop
amazon
shopee
aliexpress
shopify
```

## 3. 总体对象关系

```text
BusinessAccount
├── User
├── Store
│   └── PlatformCredential
│   └── StoreCapability
├── DataSource
│   └── SourceRecord
├── Supplier
│   └── SourcingItem
│        ├── SourceRecord
│        ├── SourcingItemMedia
│        └── SourcingItemQualification
├── SelectionDecision
│   └── SourcingItem
├── Product
│   ├── ProductVariant
│   ├── MediaAsset
│   │    └── MediaVariant
│   ├── ContentDraft
│   └── PlatformFitAssessment
│        └── ListingDraft
│             ├── ListingDraftContentLink
│             ├── ListingDraftVariant
│             └── PublishJob
│                  └── Listing
├── Order
│   ├── OrderItem
│   ├── Fulfillment
│   ├── AfterSale
│   └── Settlement
├── CostLedgerEntry
├── Subscription
│   └── Plan
├── UsageRecord
├── AuditLog
└── ApprovalTask
```

## 4. 账号、经营主体与平台授权

### 4.1 身份模型总览

ToneClaw 里必须区分四类“账号”。

| 名称 | 属于哪里 | 作用 | 例子 |
| --- | --- | --- | --- |
| BusinessAccount | ToneClaw | 经营主体 / 租户 / 数据归属边界 | “张三的跨境业务”、“LZ Cross-border” |
| User | ToneClaw | 登录和操作 ToneClaw 的人 | 老板、运营、客服 |
| ExternalSellerAccount | 外部平台 | 卖家在外部平台上的卖家账号 | Temu Seller Account、Amazon Seller Account |
| Store | 外部平台 | 卖家账号下的具体店铺 / 站点 | Temu 美国半托管店、Amazon US 店铺 |

关系是：

```text
BusinessAccount
├── User
│   ├── 老板
│   └── 后续团队成员
├── PlatformConnection
│   └── ExternalSellerAccount
│        └── Store
├── 货盘 / 商品 / 选品
├── 订单 / 履约 / 结算
├── Subscription / UsageRecord
└── AuditLog
```

重要原则：

```text
BusinessAccount 是经营主体和数据归属；
User 是 ToneClaw 操作者；
ExternalSellerAccount 是外部平台卖家账号；
Store 是外部平台店铺；
PlatformConnection 是 ToneClaw 连接外部平台卖家账号的授权关系。
```

### 4.2 BusinessAccount

经营主体 / 租户根对象。

它拥有 ToneClaw 中的业务数据、订阅、用量和审计记录。

P0 状态：

```text
active
suspended
closed
```

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 内部主键 |
| name | string | 是 | 经营主体名称 |
| owner_user_id | UUID | 是 | 主用户 |
| status | enum | 是 | active / suspended / closed |
| active_subscription_id | UUID | 否 | 当前生效订阅投影；权益以 Subscription + Entitlement 为准 |
| created_at | datetime | 是 | 创建时间 |
| updated_at | datetime | 是 | 更新时间 |

P0 只支持一个 BusinessAccount。

### 4.3 User

ToneClaw 系统用户。

P0 只需要主用户。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 用户 ID |
| business_account_id | UUID | 是 | 所属经营主体 |
| display_name | string | 是 | 显示名称 |
| email | string | 是 | 联系邮箱 |
| status | enum | 是 | active / disabled |
| locale | string | 是 | 界面语言 |

P0 不做团队角色和多用户协作。

### 4.4 ExternalSellerAccount

外部平台卖家账号。

它不是 ToneClaw User，也不是 ToneClaw BusinessAccount。

例如：

```text
Temu Seller Account
TikTok Shop Seller Account
Amazon Seller Account
```

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 内部 ID |
| business_account_id | UUID | 是 | 所属经营主体 |
| platform | enum | 是 | temu |
| external_seller_account_id | string | 是 | 平台卖家账号 ID |
| display_name | string | 否 | 平台显示名 |
| region | string | 否 | 主区域 |
| status | enum | 是 | linked / unverified / disconnected / blocked |
| linked_at | datetime | 是 | 关联时间 |
| last_verified_at | datetime | 是 | 最近验证时间 |

一个外部平台卖家账号可以拥有多个店铺。

### 4.5 Store

外部平台店铺。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 内部店铺 ID |
| business_account_id | UUID | 是 | 所属经营主体 |
| platform_connection_id | UUID | 是 | 所属平台连接 |
| platform | enum | 是 | temu |
| external_seller_account_id | string | 是 | 平台卖家账号 ID |
| external_store_id | string | 是 | 平台店铺 ID |
| name | string | 是 | 店铺名称 |
| region | string | 是 | 国家 / 地区 |
| business_mode | enum | 是 | semi_managed / full_managed / local_store |
| currency | string | 是 | 店铺主要币种 |
| timezone | string | 是 | 店铺时区 |
| status | enum | 是 | connected / disconnected / expired / error |
| connected_at | datetime | 是 | 连接时间 |
| last_synced_at | datetime | 是 | 最近同步时间 |

P0 产品边界只允许接入一个 Store，但数据模型必须按多店铺设计。

这意味着：

```text
Store 是集合对象，不是全局单例；
Store 必须归属 BusinessAccount；
PlatformConnection 可以关联一个或多个 Store；
ListingDraft / PublishJob / Listing / Order / Fulfillment / Settlement 必须携带 store_id；
Product / Supplier / SourcingItem / SelectionDecision 保持跨平台店铺无关；
P0 可以在应用层限制只创建一个 Store；
P0 不应该在数据库模型、服务接口或核心对象上假设全局只有一个 Store。
```

后续多店铺扩展原则：

```text
BusinessAccount 1:N Store；
一个 Store 只属于一个 platform；
同一个 BusinessAccount 可以有不同平台店铺；
同一 BusinessAccount 也可以有同一平台的多个店铺，前提是平台授权允许；
所有平台同步任务按 store_id 隔离；
所有平台凭据按 PlatformConnection / Store 隔离；
所有同步频率限制按 platform + store 管理。
```

P0 的实现边界：

| 层 | P0 行为 |
| --- | --- |
| 数据模型 | 支持多个 Store |
| 服务接口 | 支持 store_id 参数，但可校验当前只有一个 Store |
| UI | 只展示一个 Store |
| 平台 Adapter | 按 Store 调用，不假设全局唯一 |
| 权限 / 审计 | 保留 store_id |
| 同步 | 保留按 Store 扩展能力 |

### 4.6 PlatformConnection

ToneClaw 与外部平台卖家账号之间的授权连接。

它负责回答：

```text
这个经营主体连接了哪个平台；
连接的是哪个外部卖家账号；
使用什么授权方式；
授权状态是否有效；
能访问哪些店铺。
```

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 连接 ID |
| business_account_id | UUID | 是 | 所属经营主体 |
| platform | enum | 是 | temu |
| external_seller_account_id | string | 是 | 平台卖家账号 ID |
| connection_type | enum | 是 | oauth / app_key_secret / seller_token |
| display_name | string | 否 | 连接名称 |
| status | enum | 是 | active / expired / revoked / invalid / error |
| scopes | string[] | 是 | 授权范围 |
| connected_by_user_id | UUID | 是 | 发起连接的用户 |
| connected_at | datetime | 是 | 连接时间 |
| expires_at | datetime | 否 | 到期时间 |
| last_verified_at | datetime | 是 | 最近验证时间 |

一个 PlatformConnection 可以关联一个或多个 Store。

P0 可以简化为：

```text
1 个 PlatformConnection
→ 1 个 Temu Store
```

但模型必须支持：

```text
1 个 PlatformConnection
→ N 个 Store
```

### 4.7 PlatformCredential

平台授权凭据。

凭据挂在 PlatformConnection 上，不挂在 ToneClaw User 上，也不直接等同于 BusinessAccount。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 内部 ID |
| business_account_id | UUID | 是 | 所属经营主体 |
| platform_connection_id | UUID | 是 | 所属平台连接 |
| platform | enum | 是 | temu |
| credential_type | enum | 是 | oauth / app_key_secret / seller_token |
| secret_ref | string | 是 | 凭据安全存储引用 |
| scopes | string[] | 是 | 授权范围 |
| status | enum | 是 | active / expired / revoked / invalid |
| expires_at | datetime | 否 | 到期时间 |
| last_verified_at | datetime | 是 | 最近验证时间 |

不保存明文 Secret。

### 4.8 StoreCapability

店铺平台能力。

这个对象用来诚实表达当前平台 / 店铺支持哪些能力，以及哪些能力需要人工降级。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 能力 ID |
| store_id | UUID | 是 | 店铺 |
| capability_key | string | 是 | 能力键，如 listing.create / order.read |
| status | enum | 是 | available / unavailable / unknown |
| mode | enum | 是 | api / manual / export_import / unsupported |
| checked_at | datetime | 是 | 检查时间 |
| notes | string | 否 | 说明 |

P0 至少检查：

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

### 4.9 平台授权管理原则

#### 连接生命周期

```text
用户发起连接
→ 外部平台授权
→ 创建 ExternalSellerAccount
→ 发现 / 创建 Store
→ 创建 PlatformConnection
→ 保存 PlatformCredential
→ 初始化 StoreCapability
→ 同步店铺信息
```

#### 授权状态

```text
active：可正常调用；
expired：需要刷新或重新授权；
revoked：卖家已撤销；
invalid：凭据或店铺关系失效；
error：平台返回异常。
```

#### 隔离原则

```text
一个 BusinessAccount 不能读取另一个 BusinessAccount 的 Store；
一个 Store 的数据必须带 store_id；
一个 PlatformConnection 的凭据不能默认用于另一个 PlatformConnection；
一个平台连接的能力不能假设适用于另一个平台；
平台原始错误码不能直接透传到核心业务状态。
```

## 5. 货盘与货源

### 5.1 DataSource

货盘来源。

P0 支持：

```text
manual
excel
csv
json
```

预留：

```text
1688
cj
doba
local_pool
```

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 数据源 ID |
| business_account_id | UUID | 是 | 所属卖家 |
| type | enum | 是 | 来源类型 |
| name | string | 是 | 名称 |
| config_ref | string | 否 | 配置引用 |
| status | enum | 是 | active / disabled |
| last_synced_at | datetime | 否 | 最近同步时间 |

### 5.2 Supplier

供应商。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 内部 ID |
| business_account_id | UUID | 是 | 所属卖家 |
| name | string | 是 | 供应商名称 |
| code | string | 否 | 内部编码 |
| country | string | 是 | 国家 / 地区 |
| contact_name | string | 否 | 联系人 |
| contact_channel | string | 否 | 联系方式 |
| default_currency | string | 是 | 默认币种 |
| supply_status | enum | 是 | active / paused / blacklisted |
| rating | number | 否 | 主观评分 |
| notes | string | 否 | 备注 |

供应商是跨平台对象。

### 5.3 SourcingItem

货盘商品 / 选品候选。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 内部 ID |
| business_account_id | UUID | 是 | 所属卖家 |
| supplier_id | UUID | 否 | 供应商 |
| data_source_id | UUID | 是 | 来源 |
| source_record_id | UUID | 否 | 原始来源记录 |
| title | string | 是 | 货盘标题 |
| description_raw | text | 否 | 原始描述 |
| core_category_id | UUID | 否 | ToneClaw 类目 |
| brand | string | 否 | 品牌 |
| currency | string | 是 | 采购价币种 |
| purchase_price_minor | integer | 是 | 采购价 |
| suggested_price_minor | integer | 否 | 建议售价 |
| moq | integer | 否 | 最小起订量 |
| lead_time_days | integer | 否 | 备货周期 |
| stock_status | enum | 是 | available / low / out_of_stock / unknown |
| supply_status | enum | 是 | active / paused / discontinued |
| risk_status | enum | 是 | unknown / low / medium / high |
| status | enum | 是 | imported / candidate / selected / rejected / archived |
| attributes | AttributeValue[] | 否 | 平台无关属性 |
| tag_ids | UUID[] | 否 | 标签 |

`SourcingItem` 是平台无关对象。

### 5.4 SelectionDecision

平台无关选品决策。

它回答的问题是：

> 这个货盘商品是否值得进入 ToneClaw 经营商品池？

它不判断某个平台是否能卖；平台能力判断由 `PlatformFitAssessment` 负责。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 决策 ID |
| business_account_id | UUID | 是 | 所属卖家 |
| sourcing_item_id | UUID | 是 | 货盘商品 |
| decision | enum | 是 | candidate / approved / rejected / observing |
| reason | text | 是 | 决策理由 |
| scores | JSON | 否 | 评分明细 |
| decided_by | enum | 是 | user / ai / system |
| decided_at | datetime | 是 | 决策时间 |
| status | enum | 是 | active / superseded / canceled |
| result_product_id | UUID | 否 | 决策后创建的商品 |

规则：

```text
一个 SourcingItem 可以有多次 SelectionDecision；
当前有效决策只有 status = active 的记录；
Product.created_from_selection_id 必须能追溯到决策。
```

### 5.5 SourceRecord

原始来源记录。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 内部 ID |
| data_source_id | UUID | 是 | 来源 |
| sourcing_item_id | UUID | 是 | 关联货盘商品 |
| external_id | string | 否 | 来源系统 ID |
| raw_payload_ref | string | 是 | 原始数据存储引用 |
| checksum | string | 是 | 数据指纹 |
| imported_at | datetime | 是 | 导入时间 |

### 5.6 SourcingItemMedia

货盘图片 / 素材。

这个对象独立于 `MediaAsset`，避免货盘素材被强行绑定到 Product。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 素材 ID |
| sourcing_item_id | UUID | 是 | 货盘商品 |
| media_type | enum | 是 | image / video / document |
| purpose | enum | 是 | main / detail / scene / certificate / other |
| storage_ref | string | 是 | 存储引用 |
| source_url | string | 否 | 原始 URL |
| checksum | string | 是 | 指纹 |
| rights_status | enum | 是 | unknown / owned / licensed / restricted |
| status | enum | 是 | active / archived / blocked |

### 5.7 SourcingItemQualification

货盘资质 / 合规材料。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 资质 ID |
| sourcing_item_id | UUID | 是 | 货盘商品 |
| qualification_type | string | 是 | 资质类型 |
| file_ref | string | 是 | 文件引用 |
| status | enum | 是 | unknown / submitted / approved / rejected / expired |
| issued_by | string | 否 | 发证方 |
| issued_at | date | 否 | 签发日期 |
| expires_at | date | 否 | 到期日期 |

P0 可用于 Excel / CSV / JSON 导入追踪。

## 6. 类目与属性

### 6.1 Category

ToneClaw 核心类目。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 类目 ID |
| parent_id | UUID | 否 | 上级类目 |
| name | string | 是 | 类目名 |
| path | string | 是 | 类目路径 |
| level | integer | 是 | 层级 |
| status | enum | 是 | active / inactive |

### 6.2 AttributeDefinition

平台无关属性定义。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 属性 ID |
| key | string | 是 | 属性键 |
| name | string | 是 | 属性名 |
| value_type | enum | 是 | text / number / boolean / enum / measurement |
| unit | string | 否 | 单位 |
| is_variant_attribute | boolean | 是 | 是否为变体属性 |
| status | enum | 是 | active / inactive |

### 6.3 AttributeValue

对象上的属性值。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| attribute_id | UUID | 是 | 属性 ID |
| value_text | string | 否 | 文本值 |
| value_number | number | 否 | 数值 |
| value_boolean | boolean | 否 | 布尔值 |
| value_enum_id | UUID | 否 | 枚举值 |

### 6.4 PlatformCategoryMapping

核心类目到平台类目的映射。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 映射 ID |
| platform | enum | 是 | temu |
| category_id | UUID | 是 | 核心类目 |
| external_category_id | string | 是 | 平台类目 ID |
| external_path | string | 是 | 平台类目路径 |
| status | enum | 是 | active / inactive / unverified |

### 6.5 PlatformAttributeMapping

核心属性到平台属性的映射。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 映射 ID |
| platform | enum | 是 | temu |
| attribute_id | UUID | 是 | 核心属性 |
| external_attribute_key | string | 是 | 平台属性键 |
| external_attribute_name | string | 是 | 平台属性名 |
| value_mapping | JSON | 否 | 值映射 |
| status | enum | 是 | active / inactive / unverified |

## 7. 商品与规格

### 7.1 Product

ToneClaw 内的经营商品。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 商品 ID |
| business_account_id | UUID | 是 | 所属卖家 |
| sourcing_item_id | UUID | 否 | 货盘来源 |
| created_from_selection_id | UUID | 否 | 来源选品决策 |
| title | string | 是 | 核心标题 |
| description | text | 否 | 核心描述 |
| core_category_id | UUID | 是 | 核心类目 |
| brand | string | 否 | 品牌 |
| currency | string | 是 | 默认币种 |
| attributes | AttributeValue[] | 否 | 平台无关属性 |
| risk_status | enum | 是 | unknown / low / medium / high |
| status | enum | 是 | draft / active / paused / archived |
| created_at | datetime | 是 | 创建时间 |
| updated_at | datetime | 是 | 更新时间 |

Product 不包含 Temu 字段。

### 7.2 ProductVariant

SKU / 规格。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 规格 ID |
| product_id | UUID | 是 | 商品 ID |
| sku | string | 是 | 内部 SKU |
| barcode | string | 否 | 条码 |
| attributes | AttributeValue[] | 是 | 规格属性 |
| weight_value | number | 否 | 重量 |
| weight_unit | enum | 否 | g / kg |
| length_value | number | 否 | 长 |
| width_value | number | 否 | 宽 |
| height_value | number | 否 | 高 |
| dimension_unit | enum | 否 | cm / inch |
| purchase_price_minor | integer | 否 | 采购价 |
| currency | string | 是 | 币种 |
| status | enum | 是 | draft / active / paused / archived |

## 8. 图片与内容

### 8.1 MediaAsset

媒体资产。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 资产 ID |
| business_account_id | UUID | 是 | 所属卖家 |
| owner_type | enum | 是 | product / product_variant / sourcing_item / supplier / store |
| owner_id | UUID | 是 | 归属对象 ID |
| media_type | enum | 是 | image / video / document |
| source_type | enum | 是 | imported / generated / uploaded |
| storage_ref | string | 是 | 存储引用 |
| mime_type | string | 是 | MIME 类型 |
| checksum | string | 是 | 指纹 |
| width | integer | 否 | 宽 |
| height | integer | 否 | 高 |
| rights_status | enum | 是 | unknown / owned / licensed / restricted |
| status | enum | 是 | active / archived / blocked |

### 8.2 MediaVariant

媒体的平台变体。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 变体 ID |
| media_asset_id | UUID | 是 | 原始资产 |
| platform | enum | 是 | temu |
| purpose | enum | 是 | main / detail / scene / size_chart |
| spec_key | string | 是 | 平台规格键 |
| width | integer | 是 | 宽 |
| height | integer | 是 | 高 |
| mime_type | string | 是 | MIME 类型 |
| storage_ref | string | 是 | 存储引用 |
| status | enum | 是 | active / invalid / archived |

### 8.3 ContentDraft

AI 或人工生成的内容草稿。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 草稿 ID |
| product_id | UUID | 是 | 商品 |
| content_type | enum | 是 | title / description / bullets / keywords |
| language | string | 是 | 语言 |
| version | integer | 是 | 版本 |
| body | text | 是 | 内容 |
| generated_by | enum | 是 | ai / human / import |
| model | string | 否 | 模型 |
| usage_record_id | UUID | 否 | 用量记录 |
| status | enum | 是 | draft / approved / rejected / archived |
| reviewed_by | UUID | 否 | 审核人 |
| reviewed_at | datetime | 否 | 审核时间 |

## 9. 平台适配与发布

### 9.1 PlatformFitAssessment

平台适配评估。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 评估 ID |
| product_id | UUID | 是 | 商品 |
| store_id | UUID | 是 | 目标店铺 |
| platform | enum | 是 | temu |
| result | enum | 是 | fit / not_fit / needs_info |
| category_mapping_id | UUID | 否 | 类目映射 |
| compliance_status | enum | 是 | unknown / passed / warning / failed |
| media_status | enum | 是 | unknown / passed / warning / failed |
| price_status | enum | 是 | unknown / passed / warning / failed |
| risk_score | number | 否 | 风险分 |
| findings | Finding[] | 否 | 问题列表 |
| status | enum | 是 | draft / completed / outdated |
| assessed_at | datetime | 是 | 评估时间 |

### 9.2 Finding

适配评估发现。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| code | string | 是 | 问题编码 |
| severity | enum | 是 | info / warning / error |
| message | string | 是 | 用户可读原因 |
| field_path | string | 否 | 问题字段 |

### 9.3 ListingDraft

平台 Listing 草稿。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 草稿 ID |
| product_id | UUID | 是 | 商品 |
| store_id | UUID | 是 | 店铺 |
| platform | enum | 是 | temu |
| platform_fit_assessment_id | UUID | 是 | 适配评估 |
| title_content_draft_id | UUID | 否 | 采纳的标题内容 |
| description_content_draft_id | UUID | 否 | 采纳的描述内容 |
| bullets_content_draft_id | UUID | 否 | 采纳的卖点内容 |
| keywords_content_draft_id | UUID | 否 | 采纳的关键词内容 |
| title | string | 是 | 平台标题 |
| description | text | 是 | 平台描述 |
| bullets | string[] | 否 | 卖点 |
| keywords | string[] | 否 | 关键词 |
| platform_category_id | string | 是 | 平台类目 |
| attributes | PlatformAttributeValue[] | 是 | 平台属性 |
| price_minor | integer | 是 | 售价 |
| currency | string | 是 | 币种 |
| stock_qty | integer | 是 | 库存 |
| media_variant_ids | UUID[] | 是 | 图片 |
| status | enum | 是 | draft / ready_for_validation / validated / waiting_approval / approved / published_snapshot / archived |
| validation_result | Finding[] | 否 | 校验结果 |
| approved_by | UUID | 否 | 审批人 |
| approved_at | datetime | 否 | 审批时间 |
| last_synced_at | datetime | 否 | 最近同步 |

`ListingDraft.price_minor` 和 `ListingDraft.stock_qty` 只能作为汇总值或单 SKU 默认值。多 SKU 商品必须使用 `ListingDraftVariant`。

`ListingDraft.status` 只表达草稿准备和审批状态，不表达平台真实状态。

平台真实状态由 `Listing.core_status` 表达；单次发布动作由 `PublishJob.status` 表达。

#### 9.3.1 ListingDraftContentLink

Listing 草稿与内容草稿的引用关系。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 引用 ID |
| listing_draft_id | UUID | 是 | Listing 草稿 |
| content_draft_id | UUID | 是 | 内容草稿 |
| content_type | enum | 是 | title / description / bullets / keywords |
| is_selected | boolean | 是 | 是否被采纳 |

#### 9.3.2 ListingDraftVariant

Listing 平台变体 / Offer。

这个对象解决多 SKU 商品不能只用一个整体价格和库存的问题。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | Listing 变体 ID |
| listing_draft_id | UUID | 是 | Listing 草稿 |
| product_variant_id | UUID | 是 | 商品规格 |
| platform_variant_key | string | 是 | 平台变体键 |
| external_variant_id | string | 否 | 平台变体 ID |
| attributes | PlatformAttributeValue[] | 是 | 平台属性 |
| price_minor | integer | 是 | 变体售价 |
| currency | string | 是 | 币种 |
| stock_qty | integer | 是 | 变体库存 |
| status | enum | 是 | draft / validated / approved / submitted / live / rejected / inactive |

### 9.4 PublishJob

平台上架任务。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 任务 ID |
| listing_draft_id | UUID | 是 | Listing 草稿 |
| store_id | UUID | 是 | 店铺 |
| platform | enum | 是 | temu |
| action | enum | 是 | create / update / withdraw |
| status | enum | 是 | queued / running / succeeded / failed / canceled / needs_manual_action |
| attempt_count | integer | 是 | 尝试次数 |
| max_attempt_count | integer | 是 | 最大尝试次数 |
| external_job_ref | string | 否 | 平台任务引用 |
| error_catalog_id | UUID | 否 | 错误解释 |
| started_at | datetime | 否 | 开始时间 |
| finished_at | datetime | 否 | 结束时间 |

### 9.5 Listing

平台侧 Listing。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 内部 ID |
| product_id | UUID | 是 | 商品 |
| listing_draft_id | UUID | 是 | 来源草稿 |
| store_id | UUID | 是 | 店铺 |
| platform | enum | 是 | temu |
| external_listing_id | string | 是 | 平台 Listing ID |
| url | string | 否 | 平台链接 |
| core_status | enum | 是 | draft / submitted / platform_review / live / rejected / inactive |
| raw_status | string | 是 | 平台原始状态 |
| price_minor | integer | 是 | 当前售价 |
| currency | string | 是 | 币种 |
| stock_qty | integer | 是 | 当前库存 |
| last_synced_at | datetime | 是 | 最近同步 |

## 10. 订单与履约

### 10.1 Order

订单。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 内部 ID |
| business_account_id | UUID | 是 | 卖家 |
| store_id | UUID | 是 | 店铺 |
| platform | enum | 是 | temu |
| external_order_id | string | 是 | 平台订单 ID |
| order_number | string | 是 | 订单号 |
| status | enum | 是 | created / paid / waiting_fulfillment / shipped / delivered / canceled / closed |
| raw_status | string | 是 | 平台原始状态 |
| currency | string | 是 | 币种 |
| subtotal_minor | integer | 是 | 商品小计 |
| shipping_minor | integer | 是 | 运费 |
| discount_minor | integer | 否 | 折扣 |
| tax_minor | integer | 否 | 税费 |
| total_minor | integer | 是 | 总额 |
| placed_at | datetime | 是 | 下单时间 |
| last_synced_at | datetime | 是 | 最近同步 |

### 10.2 OrderItem

订单明细。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 明细 ID |
| order_id | UUID | 是 | 订单 |
| product_id | UUID | 否 | 商品 |
| product_variant_id | UUID | 否 | 规格 |
| listing_id | UUID | 否 | Listing |
| external_item_id | string | 是 | 平台明细 ID |
| sku | string | 是 | SKU |
| title | string | 是 | 商品标题 |
| quantity | integer | 是 | 数量 |
| unit_price_minor | integer | 是 | 单价 |
| currency | string | 是 | 币种 |

### 10.3 Fulfillment

履约 / 发货。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 履约 ID |
| order_id | UUID | 是 | 订单 |
| store_id | UUID | 是 | 店铺 |
| platform | enum | 是 | temu |
| external_fulfillment_id | string | 否 | 平台履约 ID |
| fulfillment_type | enum | 是 | seller_shipping / platform_logistics / unknown |
| status | enum | 是 | pending / stocking / shipped / in_transit / delivered / exception / canceled |
| raw_status | string | 是 | 平台原始状态 |
| carrier | string | 否 | 承运商 |
| tracking_number | string | 否 | 运单号 |
| shipped_at | datetime | 否 | 发货时间 |
| delivered_at | datetime | 否 | 签收时间 |
| exception_reason | string | 否 | 异常原因 |

### 10.4 AfterSale

售后 / 退款 / 争议。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 售后 ID |
| order_id | UUID | 是 | 订单 |
| store_id | UUID | 是 | 店铺 |
| platform | enum | 是 | temu |
| external_after_sale_id | string | 否 | 平台售后 ID |
| type | enum | 是 | refund / return / dispute / complaint |
| status | enum | 是 | opened / processing / approved / rejected / completed / canceled |
| raw_status | string | 是 | 平台原始状态 |
| reason | string | 否 | 原因 |
| amount_minor | integer | 否 | 涉及金额 |
| currency | string | 是 | 币种 |

P0 可以只读展示，不做自动处理。

### 10.5 Settlement

结算 / 回款。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 结算 ID |
| business_account_id | UUID | 是 | 卖家 |
| store_id | UUID | 是 | 店铺 |
| platform | enum | 是 | temu |
| external_settlement_id | string | 否 | 平台结算 ID |
| period_start | date | 否 | 开始日期 |
| period_end | date | 否 | 结束日期 |
| gross_minor | integer | 是 | 总收入 |
| platform_fee_minor | integer | 是 | 平台费用 |
| commission_minor | integer | 是 | 佣金 |
| shipping_fee_minor | integer | 否 | 物流费 |
| refund_minor | integer | 否 | 退款 |
| adjustment_minor | integer | 否 | 调整 |
| net_minor | integer | 是 | 净额 |
| currency | string | 是 | 币种 |
| status | enum | 是 | pending / processing / paid / failed |
| paid_at | datetime | 否 | 回款时间 |

## 11. 成本与利润

### 11.1 CostLedgerEntry

成本 / 费用流水。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 流水 ID |
| business_account_id | UUID | 是 | 卖家 |
| related_type | enum | 是 | sourcing_item / product / order / fulfillment |
| related_id | UUID | 是 | 关联对象 |
| cost_type | enum | 是 | purchase / shipping / platform_fee / commission / ai_usage / adjustment |
| amount_minor | integer | 是 | 金额 |
| currency | string | 是 | 币种 |
| direction | enum | 是 | inflow / outflow |
| exchange_rate_snapshot | number | 否 | 记账时汇率快照 |
| base_currency | string | 是 | 卖家基础币种 |
| base_amount_minor | integer | 是 | 基础币种金额 |
| occurred_at | datetime | 是 | 发生时间 |
| source_type | enum | 是 | manual / imported / calculated / platform |
| notes | string | 否 | 备注 |

### 11.2 ProfitSummary

利润摘要。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 摘要 ID |
| business_account_id | UUID | 是 | 卖家 |
| scope_type | enum | 是 | product / order / store / period |
| scope_id | UUID | 是 | 对象 ID |
| revenue_minor | integer | 是 | 收入 |
| cost_minor | integer | 是 | 成本 |
| gross_profit_minor | integer | 是 | 毛利 |
| net_profit_minor | integer | 是 | 净利 |
| currency | string | 是 | 币种 |
| period_start | date | 是 | 开始日期 |
| period_end | date | 是 | 结束日期 |

## 12. 商业化与用量

### 12.1 Plan

套餐定义。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 套餐 ID |
| code | string | 是 | 套餐编码 |
| name | string | 是 | 名称 |
| price_minor | integer | 是 | 价格 |
| currency | string | 是 | 币种 |
| billing_period | enum | 是 | monthly / yearly / lifetime |
| features | string[] | 是 | 功能项 |
| token_quota | integer | 是 | Token 额度 |
| max_stores | integer | 是 | 最大店铺数 |
| max_products | integer | 是 | 最大商品数 |
| status | enum | 是 | active / retired |

### 12.2 Subscription

订阅 / 授权。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 订阅 ID |
| business_account_id | UUID | 是 | 卖家 |
| plan_id | UUID | 是 | 套餐 |
| status | enum | 是 | trial / active / expired / canceled / suspended |
| starts_at | datetime | 是 | 开始时间 |
| ends_at | datetime | 是 | 结束时间 |
| auto_renew | boolean | 是 | 是否自动续费 |
| last_verified_at | datetime | 是 | 最近校验时间 |

### 12.3 Entitlement

功能权益。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 权益 ID |
| subscription_id | UUID | 是 | 订阅 |
| feature_key | string | 是 | 功能键 |
| limit_type | enum | 是 | boolean / count / period_count |
| limit_value | number | 是 | 限制值 |
| status | enum | 是 | active / expired / disabled |

### 12.4 UsageRecord

AI / Token 用量。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 用量 ID |
| business_account_id | UUID | 是 | 卖家 |
| user_id | UUID | 是 | 用户 |
| scene | enum | 是 | sourcing_analysis / image_generation / listing_generation / report |
| model | string | 是 | 模型 |
| input_tokens | integer | 是 | 输入 Token |
| output_tokens | integer | 是 | 输出 Token |
| total_tokens | integer | 是 | 总 Token |
| cost_estimate_minor | integer | 是 | 成本估算 |
| currency | string | 是 | 币种 |
| related_type | enum | 否 | 关联对象类型 |
| related_id | UUID | 否 | 关联对象 |
| status | enum | 是 | succeeded / failed / refunded |
| occurred_at | datetime | 是 | 发生时间 |

## 13. 审计与审批

### 13.1 AuditLog

审计日志。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 日志 ID |
| business_account_id | UUID | 是 | 卖家 |
| actor_type | enum | 是 | user / system / ai / platform |
| actor_id | string | 是 | 执行者 |
| action | string | 是 | 动作 |
| target_type | string | 是 | 对象类型 |
| target_id | string | 是 | 对象 ID |
| before_ref | string | 否 | 变更前引用 |
| after_ref | string | 否 | 变更后引用 |
| reason | string | 否 | 原因 |
| occurred_at | datetime | 是 | 发生时间 |

### 13.2 ApprovalTask

人工确认任务。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 任务 ID |
| business_account_id | UUID | 是 | 卖家 |
| target_type | string | 是 | 对象类型 |
| target_id | UUID | 是 | 对象 ID |
| task_type | enum | 是 | listing_approval / publish_confirmation / high_cost_ai / manual_action |
| status | enum | 是 | pending / approved / rejected / expired / canceled |
| reason | string | 是 | 原因 |
| assigned_to | UUID | 否 | 负责人 |
| created_at | datetime | 是 | 创建时间 |
| resolved_at | datetime | 否 | 处理时间 |

## 14. 同步与错误

### 14.1 SyncJob

同步任务。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 任务 ID |
| business_account_id | UUID | 是 | 卖家 |
| store_id | UUID | 否 | 店铺 |
| platform | enum | 否 | temu |
| object_type | enum | 是 | store / platform_category / platform_attribute / store_capability / listing / order / fulfillment / after_sale / settlement |
| job_type | enum | 是 | pull / push / verify |
| status | enum | 是 | queued / running / succeeded / failed / canceled |
| attempt_count | integer | 是 | 尝试次数 |
| max_attempt_count | integer | 是 | 最大尝试 |
| next_run_at | datetime | 否 | 下次运行 |
| error_catalog_id | UUID | 否 | 错误解释 |
| started_at | datetime | 否 | 开始时间 |
| finished_at | datetime | 否 | 结束时间 |

### 14.2 ErrorCatalogEntry

错误解释目录。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 错误 ID |
| platform | enum | 是 | temu |
| raw_code | string | 是 | 平台错误码 |
| category | enum | 是 | auth / permission / validation / rate_limit / server / unknown |
| user_message | string | 是 | 用户可读信息 |
| retryable | boolean | 是 | 是否可重试 |
| remediation | string | 否 | 处理建议 |

## 15. 洞察与报告

### 15.1 Insight

经营洞察。

最小字段：

| 字段 | 类型 | P0 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 洞察 ID |
| business_account_id | UUID | 是 | 卖家 |
| insight_type | enum | 是 | daily_report / funnel / exception / suggestion |
| scope_type | enum | 是 | store / product / listing / order / usage |
| scope_id | UUID | 是 | 对象 ID |
| period_start | date | 是 | 开始日期 |
| period_end | date | 是 | 结束日期 |
| title | string | 是 | 标题 |
| summary | text | 是 | 摘要 |
| metrics | JSON | 否 | 指标 |
| generated_by | enum | 是 | system / ai / human |
| status | enum | 是 | draft / published / dismissed |

## 16. P0 对象范围

### P0 主链路必须实现

```text
BusinessAccount
User
Store
PlatformCredential
DataSource
Supplier
SourcingItem
SourceRecord
Product
ProductVariant
SelectionDecision
MediaAsset
SourcingItemMedia
SourcingItemQualification
MediaVariant
ContentDraft
PlatformFitAssessment
ListingDraft
ListingDraftContentLink
ListingDraftVariant
PublishJob
Listing
Order
OrderItem
Fulfillment
Plan
Subscription
Entitlement
UsageRecord
AuditLog
ApprovalTask
SyncJob
ErrorCatalogEntry
StoreCapability
```

### P0 只读或最小实现

```text
Category
AttributeDefinition
PlatformCategoryMapping
PlatformAttributeMapping
Order
OrderItem
Fulfillment
AfterSale
Settlement
CostLedgerEntry
ProfitSummary
Insight
```

### P0 只预留

```text
TeamRole
MultiStore
Warehouse
PurchaseOrder
InventoryLedger
TaxRule
PaymentProvider
MarketSignal
CompetitorSignal
DemandSignal
RiskSignal
AgentTask
```

## 17. 审核结论

本文件当前状态为：

```text
方向正确，可作为 M0 设计输入；
仍需在评审后继续收口字段、约束和状态机。
```

本轮已修正：

1. 补充 `SelectionDecision`；
2. 补充 `ListingDraftVariant`，支持多 SKU；
3. 补充 `ListingDraftContentLink`，保证 AI 内容可追溯；
4. 补充 `SourcingItemMedia` 和 `SourcingItemQualification`；
5. 增加 `StoreCapability`，显式表达平台能力和降级路径；
6. 调整 `MediaAsset` 为通用归属模型；
7. 增加成本方向和基础币种换算快照；
8. 收敛 P0 对象范围，拆分主链路、只读和预留；
9. 明确 Product、ListingDraft、PublishJob、Listing 的状态职责。

下一份文档仍然是：

```text
docs/STATE_MACHINES.md
```

## 18. 下一份文档

本文完成后，下一份应创建：

```text
docs/STATE_MACHINES.md
```

重点定义：

```text
Supplier
SourcingItem
SelectionDecision
Product
PlatformFitAssessment
ListingDraft
PublishJob
Listing
Order
Fulfillment
AfterSale
Settlement
Subscription
UsageRecord
ApprovalTask
SyncJob
```
