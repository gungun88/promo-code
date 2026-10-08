# 创建额度与积分中心规则迁移 PRD

## 1. 背景

当前系统在“系统设置”中通过累计优惠码上限、公开展示上限、每日新增上限和重复优惠码开关限制用户创建优惠码。该模型依赖固定数量阈值，无法支持用户通过积分自主扩展创建能力，也让创建额度、置顶推广、积分兑换分散在不同位置。

本需求将创建能力改为“创建额度”模型，并将相关运营规则统一迁移到“积分中心”。

## 2. 目标与非目标

### 2.1 目标

- 每个账号默认获得 1 次免费创建额度。
- 创建优惠码成功时消耗 1 次创建额度；创建失败不扣额度。
- 用户可在积分中心使用积分购买创建额度，购买后的额度永久有效。
- 后台可配置创建额度套餐、积分价格和“禁止同商户重复优惠码”规则。
- 系统设置移除原创建优惠限制面板及其旧配置入口。
- 旧用户平滑迁移：已有账号按现有已创建数量计算历史消耗，并获得至少 1 次免费额度的兼容权益。

### 2.2 非目标

- 本期不设置创建额度过期时间。
- 本期不支持额度转让、提现或退款。
- 不改变优惠码公开展示排序、置顶推广和积分兑换逻辑。
- 不移除平台级安全保护，例如邮箱验证、账号暂停、接口限流。

## 3. 核心规则

### 3.1 创建额度

每个用户有一个创建额度账户：

```text
可用额度 = 免费额度 + 购买额度 + 管理员补偿额度 - 已消耗额度
```

- 新用户免费额度为 1。
- 旧用户迁移时免费额度至少为 1；历史已创建优惠码不自动扣除这 1 次兼容额度，避免老用户首次编辑/创建被突然阻断。
- 购买额度永久有效。
- 每次成功创建一条优惠码消耗 1 次额度。
- 编辑优惠码不消耗额度。
- 暂停、恢复、删除优惠码不返还额度。
- 创建操作与额度扣除必须在同一事务中完成。
- 并发创建时锁定额度账户，不能出现负数或超额创建。

### 3.2 重复优惠码规则

“禁止同商户重复优惠码”从系统设置迁移到积分中心的创建规则区域。

- 开启：同一商户下忽略大小写的 `code` 只能保留一条；创建和编辑都校验。
- 关闭：允许同一商户存在重复 code。
- 规则修改只影响后续创建和编辑，不自动删除历史重复记录。
- 默认保持现有值，避免迁移后行为改变。

### 3.3 创建额度套餐

后台配置固定套餐，每个套餐包含：

| 字段 | 规则 |
| --- | --- |
| 套餐名称 | 必填，最多 40 字符 |
| 创建次数 | 正整数，1–1000 |
| 消耗积分 | 正整数 |
| 是否启用 | 至少保留一个启用套餐 |

建议默认套餐：1 次/10 积分、5 次/40 积分、10 次/70 积分。实际价格可由后台修改。

## 4. 用户端流程

### 4.1 创建优惠码

1. 用户进入创建优惠码页。
2. 页面显示“可用创建次数”及本次创建将消耗 1 次额度。
3. 可用额度大于 0 时允许提交。
4. 可用额度为 0 时禁止提交，显示：

   > 创建次数已用完，可前往积分中心购买创建额度。

5. 创建成功后额度减 1，并刷新额度显示和优惠码列表。

### 4.2 积分中心

积分中心增加“创建额度”区域：

- 当前可用创建次数
- 创建额度购买套餐
- 购买按钮和扣除积分确认
- 创建额度流水（赠送、购买、消耗、管理员补偿）
- 购买成功后刷新积分余额和可用额度

额度不足时，提供从创建页跳转积分中心的入口。

## 5. 后台需求

### 5.1 系统设置

删除“创建优惠限制”面板及以下字段：

- 累计优惠码上限
- 公开展示上限
- 每日新增上限
- 禁止同商户重复优惠码

保留其他系统设置。旧 API 字段在短期内可以继续返回兼容值，但不再作为创建接口的限制来源。

### 5.2 积分中心

新增“创建规则”区域：

- 禁止同商户重复优惠码开关
- 创建额度套餐列表
- 新增套餐
- 修改套餐名称、次数、积分和启用状态
- 删除套餐；至少保留一个套餐，已被历史购买记录引用的套餐不物理删除，改为停用
- 保存配置

### 5.3 创建额度记录

后台可查看创建额度流水：

- 用户邮箱
- 类型：免费赠送、积分购买、创建消耗、管理员补偿
- 额度变动
- 变动后余额
- 关联优惠码/套餐
- 时间

本期不强制增加独立后台导航，放在积分中心下方分页列表或 Tab 中。

## 6. 数据模型

### 6.1 `user_creation_quota_accounts`

```text
user_id uuid PK FK users(id)
free_quota integer NOT NULL DEFAULT 1
purchased_quota integer NOT NULL DEFAULT 0
adjustment_quota integer NOT NULL DEFAULT 0
consumed_quota integer NOT NULL DEFAULT 0
created_at timestamptz NOT NULL
updated_at timestamptz NOT NULL
```

可用额度使用数据库表达式计算，不允许小于 0：

```text
free_quota + purchased_quota + adjustment_quota - consumed_quota >= 0
```

### 6.2 `creation_quota_packages`

```text
id uuid PK
name text NOT NULL
quota integer NOT NULL
points integer NOT NULL
enabled boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL
updated_at timestamptz NOT NULL
```

### 6.3 `creation_quota_ledger`

```text
id uuid PK
user_id uuid FK users(id)
entry_type text CHECK (entry_type IN ('free_grant','purchase','consume','adjustment'))
delta integer NOT NULL
balance_after integer NOT NULL
package_id uuid NULL FK creation_quota_packages(id)
promo_code_id uuid NULL FK promo_codes(id)
description text NOT NULL DEFAULT ''
created_at timestamptz NOT NULL
```

### 6.4 `app_settings`

继续使用 JSON 配置：

```text
pointsConfig.creationRule.preventDuplicateMerchantCodes
pointsConfig.creationPackages[]
```

为兼容已有数据，读取时可回退到旧 `preventDuplicateMerchantCodes` 值；保存积分中心规则后，以新配置为准。

## 7. API 草案

### 用户接口

```text
GET  /api/user/creation-quota
GET  /api/user/creation-quota/ledger?page=&limit=
POST /api/user/creation-quota/purchase       # { packageId }
```

### 现有接口调整

```text
POST /api/user/deals
```

服务端必须：

- 验证用户已登录、邮箱已验证、商户状态正常
- 锁定创建额度账户
- 验证可用额度大于 0
- 根据积分中心规则校验重复 code
- 创建优惠码、消耗额度、写额度流水
- 事务全部成功后返回优惠码和剩余额度

### 管理员接口

```text
GET   /api/admin/points/settings
PUT   /api/admin/points/settings
GET   /api/admin/creation-quota/ledger?page=&limit=&q=&entryType=
```

现有 `/api/admin/settings` 不再保存新创建规则；旧字段只作为迁移兼容读取，不再提供前台编辑。

## 8. 错误提示

| 场景 | HTTP | 提示 |
| --- | ---: | --- |
| 没有创建额度 | 400 | 创建次数已用完，请前往积分中心购买创建额度 |
| 套餐不存在/停用 | 400 | 创建额度套餐不可用 |
| 积分不足 | 400 | 积分余额不足 |
| 重复优惠码 | 409 | 同一商户下已存在相同优惠码 |
| 并发额度不足 | 409 | 创建次数已被使用，请刷新后重试 |

## 9. 迁移方案

1. 新增创建额度账户、套餐和流水表。
2. 为已有用户创建账户，`free_quota=1`，其他字段为 0。
3. 将旧重复 code 设置复制到 `pointsConfig.creationRule.preventDuplicateMerchantCodes`。
4. 保留旧设置字段一段时间，但创建接口不再读取数量上限。
5. 新用户注册时自动创建额度账户并写入 `free_grant` 流水。
6. 首次部署后由管理员检查默认套餐和重复 code 开关，再开放用户购买入口。

## 10. 验收标准

- 新用户注册后可用创建次数为 1。
- 创建成功后可用次数减少 1，并产生 `consume` 流水。
- 创建失败、重复 code、积分不足时不扣创建额度。
- 并发创建不会产生负余额或超额创建。
- 额度用完后创建页明确引导积分中心。
- 积分购买额度后永久有效，余额和额度流水正确。
- 后台可新增、编辑、停用创建额度套餐。
- 重复 code 开关在积分中心可配置，系统设置不再显示旧创建限制面板。
- 原有置顶、积分兑换和管理员人工置顶流程不受影响。
- `npm run build` 通过，数据库 schema 可重复初始化。

## 11. 产品待确认

- 默认套餐价格是否采用建议值。
- 是否需要管理员手动补偿创建额度 UI；MVP 可先保留 API/数据库能力。
- 是否需要展示“累计已创建次数”统计；建议首版展示在额度流水中即可。

