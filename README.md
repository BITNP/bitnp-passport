# BITNP Passport （新版网协通行证）

基于 Keycloak 的网协通行证。

旧版通行证：<https://github.com/BITNP/keycloak-account-service>

## 部署准备

准备以下服务：

- Docker 与 Docker Compose，或者 Podman
- PostgreSQL
- Keycloak 26 实例

## 配置环境变量

在仓库根目录执行：

```sh
cp .env.example .env
```

编辑 `.env`，填写实际配置：

| 变量                             | 说明                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `BITNP_PASSPORT_IMAGE`           | 应用镜像名，本机构建可用 `bitnp-passport:local`                               |
| `APP_URL`                        | 通行证公开地址，如 `https://accounts.bitnp.net`，使用域名根路径               |
| `DATABASE_URL`                   | 通行证 PostgreSQL 连接串                                                      |
| `OIDC_ISSUER_URL`                | Keycloak realm 地址，如 `https://sso.example.com/realms/master`，不带末尾斜杠 |
| `OIDC_CLIENT_ID`                 | 通行证客户端 ID，默认示例为 `bitnp-passport`                                  |
| `OIDC_CLIENT_SECRET`             | 通行证客户端密钥                                                              |
| `KEYCLOAK_SERVICE_CLIENT_ID`     | 服务客户端 ID，默认示例为 `bitnp-passport-service`                            |
| `KEYCLOAK_SERVICE_CLIENT_SECRET` | 服务客户端密钥                                                                |
| `SESSION_ENCRYPTION_KEY`         | 32 字节随机密钥的 Base64 编码，用于保存登录会话                               |
| `LOG_LEVEL`                      | 日志级别，通常使用 `info`，排查问题时可改为 `debug`                           |

生产部署建议使用 Forgejo Container Registry 中的固定版本镜像，例如 `git.bitnp.net/bitnp/bitnp-passport:v1.0.0`。

可用以下命令生成会话密钥，将结果填入 `SESSION_ENCRYPTION_KEY`：

```sh
openssl rand -base64 32
```

## 配置 Keycloak

下面的 `<APP_URL>` 需要被替换为 `.env` 配置的地址

### 通行证客户端

创建 OpenID Connect 客户端 `bitnp-passport`：

| 设置                            | 值                                                 |
| ------------------------------- | -------------------------------------------------- |
| 客户端认证                      | 开启 Client authentication                         |
| 登录流程                        | 开启 Standard flow，并保持 Use refresh tokens 开启 |
| Valid redirect URIs             | `<APP_URL>/auth/callback`                          |
| Valid post logout redirect URIs | `<APP_URL>` 和 `<APP_URL>/i/*`                     |
| PKCE                            | `S256`                                             |

关闭 Implicit flow、Direct access grants 和 Service accounts。保留 `profile`、`email`、`roles` client scopes 及其默认映射。

启用内置的 `account` 客户端，确保普通用户拥有其 `manage-account` 角色，并允许该角色进入通行证客户端签发的 access token。Token 的 audience 需要包含 `account`，可在通行证客户端添加 Audience mapper，Included Client Audience 设为 `account`，并开启 Add to access token。

将通行证客户端密钥填入 `OIDC_CLIENT_SECRET`。

### 服务客户端

创建 OpenID Connect 客户端 `bitnp-passport-service`：

1. 开启 Client authentication
2. 开启 Service accounts，关闭 Standard flow、Implicit flow 和 Direct access grants
3. 在 Service account roles 中，授予 `master-realm` 客户端的 `manage-users`、`view-realm`、`view-clients` 和 `query-clients` 角色
4. 将客户端密钥填入 `KEYCLOAK_SERVICE_CLIENT_SECRET`

如果现有实例启用了细粒度管理权限，还需允许服务账户查询用户与群组、创建群组和管理成员。服务账户用于通行证访问 Keycloak；管理员权限规则见下文。

### 账户与注销配置

- 关闭通行证客户端的 Front channel logout
- Backchannel logout URL 填 `<APP_URL>/auth/backchannel-logout`
- 开启 Backchannel logout session required，并保证 Keycloak 可以访问该 URL
- 在 Realm settings → User profile 中，取消 `lastName` 的 Required；通行证用一个“真实姓名”字段保存姓名，可将 `firstName` 的 Display name 设为“真实姓名”，保留用户编辑权限

修改密码、删除认证器等操作会跳转到 Keycloak 完成，然后返回通行证。

### 注册、身份与账户策略

- 允许自行注册时，在 realm 中开启 User registration
- 关闭 Duplicate emails
- 启用 Forgot password 并配置 SMTP，供用户通过邮件重置密码；按需配置 Verify email、密码策略和多因素认证
- “网协现任”由 `position-*` 角色决定：普通成员通过部门组的 `position-<department>-member` 获得，职务通过个人 `position-*` 授予；`position-association-vice-chair` 仅作为复合角色父级，不单独计入
- 当前届组织取 `/bitnp/active-YYYY` 下四个部门组都配置了 `position-<department>-member` 的最新一届；增删 `shared/identity.ts` 中的 `departments` 时需同步调整并迁移已有届的映射
- 通行证本地会话保留两周，登录或令牌续期后延长；令牌是否有效仍由 Keycloak 的 SSO Session、Client Session 等设置控制

帮助页的“重置密码”和账户安全页的“忘记密码？”均通过 `/auth/reset-password` 进入 Keycloak 的 `protocol/openid-connect/forgot-credentials` 重置流程，复用通行证的 OIDC 回调，完成后返回账户安全页。

## 首次上线

### 1. 构建镜像

完成 `.env` 和 Keycloak 配置后，在仓库根目录执行：

```sh
docker compose build web
```

### 2. 初始化数据库

```sh
docker compose run --rm web node scripts/migrate.ts
```

该命令创建或升级通行证数据表，并初始化后台任务队列。每次发布执行一次。

### 3. 管理权限

通行证从 Keycloak 读取有效角色。系统管理使用 `permission-system-admin`，部门管理使用 `permission-<department>-admin`。具体请见内部 Keycloak 权限文档。

### 4. 启动服务与配置代理

```sh
docker compose up -d
docker compose ps
docker compose logs --tail=100 web worker
```

Compose 将网站绑定到宿主机的 `127.0.0.1:3000`。配置宿主机上的反向代理，将 `APP_URL` 对应域名的全部请求转发到 `http://127.0.0.1:3000`，并提供 HTTPS。

## 发布版本

```sh
git remote add forgejo https://git.bitnp.net/BITNP/bitnp-passport.git
docker login git.bitnp.net
```

```sh
scripts/publish-release.sh v1.0.0
```

## 组织与换届

群组在 Keycloak 中存在后，可在后台“群组配置”中明确纳入或取消纳入。

后台“任职管理”维护个人职务，“系统管理权限”展示有效系统权限及来源。换届页面从 Keycloak 读取当前组织，确认四个部门的成员身份映射、个人任职和旧届邀请变化。历史组织关系及个人特殊授权保持独立。

## 本地开发

### 首次启动

```sh
pnpm install --frozen-lockfile
cp dev/development.env .env
pnpm dev:up
pnpm db:migrate
pnpm dev
```

在另一个终端进入仓库目录，启动后台任务：

```sh
pnpm worker
```

| 服务                | 地址                                       |
| ------------------- | ------------------------------------------ |
| 通行证              | `http://localhost:3000`                    |
| Keycloak 管理控制台 | `http://localhost:8080/admin/`             |
| PostgreSQL          | `localhost:5432`，用户名和密码均为 `bitnp` |

### 测试账户

开发 Keycloak 使用与线上相同的 `position-*` / `permission-*` 模型，包含 64 个组织群组和 168 个测试账户。所有测试账户的密码均为 `dev-password`。

| 用户名                  | Keycloak 身份与权限                |
| ----------------------- | ---------------------------------- |
| `admin`                 | 个人特批系统管理员                 |
| `manager`               | 技术部部长，只有技术部管理权限     |
| `member`                | 本届技术部普通成员                 |
| `outsider`              | 无组织归属，用于测试邀请注册和加入 |
| `vice-techdept-1`       | 分管技术部的副主席，无系统权限     |
| `vice-techdept-special` | 相同职务，另有个人特批系统权限     |

### 日常开发

数据库已经初始化后，每次开发只需运行：

```sh
pnpm dev:up
pnpm dev
```

另一个终端运行 `pnpm worker`。
