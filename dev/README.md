# 开发权限数据

`master-realm.json` 的群组、角色组合和角色输出配置按 2026-10-19 的线上 `master` realm 整理，开发 Keycloak 固定为 26.8.1。使用虚构测试账户，密码统一为 `dev-password`。

## 模型

- 64 个群组保留线上相同的路径和直接角色映射，包括历史届别。
- 20 个 `position-*` 角色表示成员身份与职务；9 个 `permission-*` 角色表示功能权限。
- 拥有任一部门管理权限或系统管理权限即可进入管理工作台并维护成员业务资料，无需额外角色。
- `/bitnp/active-2026` 直接授予 `bitnp-active`，四个部门组分别授予对应的 `position-部门-member`。
- 主席团和管理层组只表示组织归属，不统一授予管理权限。
- 每个群组至少有两名直接测试成员；每种个人职务有两名测试任职者。副主席共同身份通过三个分管职务继承，不单独分配。
- 主席与技术保障中心正副主任按线上角色组合获得系统权限；其他部门负责人和分管副主席不会因此获得系统权限。

角色和群组是权限的来源，客户端 scope / mapper 只控制 token 输出。通行证、服务账户与 RustFS 测试客户端复用线上相同的角色映射。服务账户保持 `fullScopeAllowed=false`，只输出 `master-realm` 的 `manage-users`、`view-realm`、`view-clients`、`query-clients`。

## 常用账户

| 账户                                   | 场景                                                         |
| -------------------------------------- | ------------------------------------------------------------ |
| `admin`                                | 个人直接拥有 `permission-system-admin`，用来管理开发环境     |
| `manager`                              | 技术部部长，拥有技术部 admin / access，无系统权限            |
| `member`                               | 本届技术部普通成员，只通过组获得成员身份与 access            |
| `outsider`                             | 无组织、无职务，用来测试邀请注册及加入                       |
| `legacy-admin`                         | 只有内置 `admin`，不反向拥有 `permission-system-admin`       |
| `chair-1`、`chair-2`                   | 正主席，继承四个部门管理权限与系统权限                       |
| `vice-techdept-1`、`vice-techdept-2`   | 分管技术部的副主席，无系统权限                               |
| `vice-techdept-special`                | 分管技术部副主席，额外直接授予个人系统权限                   |
| `system-special-1`、`system-special-2` | 技术部普通成员，额外直接授予个人系统权限                     |
| `multi-position`                       | 同时为技术部副部长、电脑诊所顾问，测试独立撤职与多来源权限   |
| `external-director`                    | 技术部成员，同时任技术保障中心副主任；职务不自动改变组织归属 |

其余个人职务账户遵循 `techdept-head-1`、`clinic-deputy-2`、`digimedia-advisor-1`、`techsvc-director-2` 等命名。群组成员使用 `2026-techdept-1`、`2026-techsvc-2`、`2025-clinic-1` 等名字；年份根组和总根组也各有两名测试成员。

`2026-master-1`、`2026-management-1` 没有职务和管理权限。`2026-techsvc-1` 只有内部资源访问权。历史组如 `2025-techdept-1` 不继承本届成员身份、现任标记或功能权限。

## 使用

按项目 README 启动开发服务。全新的 Keycloak 数据卷会自动导入这份配置，已有 realm 不会因 `--import-realm` 被覆盖。已有实例的模型应通过 Admin API 更新，保留自行添加的用户和测试群组；不要删除 PostgreSQL 卷来更新 Keycloak 种子。

通行证的部门鉴权、个人任职、系统特批与换届均读取这套角色模型。管理层可维护所有人的成员业务资料；群组成员与邀请的管理仍限制在本届本部门已纳入群组。职务任命与特殊授权由系统管理员执行。开发数据中的原生 `admin` 维护账户不会反向成为通行证系统管理员。

## 检查代码

```sh
pnpm typecheck
pnpm exec tsc -p tsconfig.backend.json
```

成员、邀请及换届的实际验证需要独立的 Keycloak 实例和一次性通行证数据库，不能复用日常开发数据。
