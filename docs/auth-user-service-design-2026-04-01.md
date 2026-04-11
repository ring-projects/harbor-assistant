# Harbor 服务端用户与认证设计

## 1. 文档信息

- 文档名称：Harbor 服务端用户与认证设计
- 日期：2026-04-01
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/user`（future）
  - `apps/service/src/modules/auth`（future）
  - `apps/service/src/modules/project`
  - `apps/service/src/modules/task`
  - `apps/service/src/modules/orchestration`
  - `apps/service/src/modules/filesystem`
  - `apps/service/src/modules/git`
  - `apps/web` 登录态接入与跨域调用约束
- 关联文档：
  - [./backend-lite-ddd-design-2026-03-24.md](./backend-lite-ddd-design-2026-03-24.md)
  - [./service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
  - [./project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
  - [./orchestration-requirements-2026-03-31.md](./orchestration-requirements-2026-03-31.md)
  - [./interaction-context-design-2026-03-24.md](./interaction-context-design-2026-03-24.md)
  - [./project-api.md](./project-api.md)
  - [./task-api.md](./task-api.md)

## 2. 文档目标

本文定义 Harbor 从“本地默认信任工具”走向“部署在单台服务器上的受信任小团队服务”时，`user` 与 `auth` 应如何设计。

本文回答以下问题：

1. 当前部署目标下，认证与授权的系统边界是什么
2. 为什么第一阶段应采用 `GitHub OAuth + Harbor 自有 session`，而不是直接做 JWT 或重型权限系统
3. `user / auth / project / task / filesystem / git` 的职责应如何划分
4. 数据模型、接口模型、会话模型应如何落地
5. 为什么现有“任意服务器路径 + 匿名 WebSocket”的模型必须随着部署一起收敛

本文不是公网多租户 SaaS 设计，也不是最终企业权限系统设计。

## 3. 背景与约束

### 3.1 当前系统更接近本地工具，而不是服务器产品

从现有实现看，Harbor 后端已经有清晰的模块边界与路由注册方式，但仍然带有明显的本地工具假设：

1. 调用方默认可信
2. 项目根目录可由请求方直接指定
3. WebSocket 连接当前不基于显式用户身份校验
4. 服务主要围绕本地文件系统和本地 agent runtime 工作

这在本机开发阶段是合理的，但部署到服务器后会直接变成系统边界问题。

### 3.2 本文面向的目标场景

本文只讨论以下场景：

```text
Harbor 部署在一台服务器上，供自己或一个受信任的小团队使用。
```

这意味着：

1. 不是开放注册的公网 SaaS
2. 不需要第一版就做复杂租户系统
3. 不需要第一版就做完整 RBAC
4. 但必须有明确的登录态、资源归属和访问边界

### 3.3 当前不应假设的能力

第一阶段不应假设以下能力已经存在：

1. 每用户独立容器级沙箱
2. 复杂团队组织树与角色矩阵
3. 跨服务 JWT 验证体系
4. 基于 GitHub token 的仓库托管访问体系

因此，本文的设计目标是：

```text
用最小但完整的用户与认证模型，把 Harbor 收敛成可部署、可控、可扩展的团队服务。
```

## 4. 核心结论

### 4.1 第一阶段采用 `GitHub OAuth + Harbor 自有服务端 session`

在当前场景下，最合理的认证方案不是：

1. 直接让前端持有 GitHub access token 作为登录态
2. 直接用 JWT 作为主会话模型
3. 一开始就建设通用 SSO / RBAC 平台

第一阶段应采用：

```text
GitHub 负责证明“你是谁”。
Harbor 自己维护“你当前是否已登录本服务”。
```

也就是：

1. GitHub OAuth 只作为身份提供方
2. Harbor 在回调后创建自己的 session
3. HTTP 与 WebSocket 都复用 Harbor session 做鉴权

### 4.2 `user` 与 `auth` 必须拆开，而不是合成一个大模块

建议分成两个 future module：

1. `user`
2. `auth`

职责收敛如下：

`user` 负责：

1. 用户身份资料
2. 用户显示信息
3. 用户状态
4. 用户生命周期

`auth` 负责：

1. OAuth 登录流程
2. session 创建与吊销
3. 当前登录态解析
4. 路由鉴权

这样做的原因是：

1. `user` 是业务主语
2. `auth` 是访问控制能力
3. 后续即使接入别的身份源，也不应污染 `user` 模块边界

### 4.3 第一阶段采用“项目归属到用户”的最小授权模型

对于单服务器小团队场景，不建议第一版就引入：

1. `Workspace`
2. `WorkspaceMember`
3. `RoleBinding`
4. 复杂项目共享策略

第一阶段更合理的授权模型是：

```text
Project belongs to one user.
Task / Orchestration / Document 通过 Project 继承访问权限。
```

也就是说：

1. `Project` 新增 `ownerUserId`
2. `Task / Orchestration / Document` 不急于冗余保存 `userId`
3. 所有资源访问先通过 `project.ownerUserId` 做权限判断

### 4.4 现有文件系统模型必须一起收口

部署版不能继续保留“前端传什么 rootPath，后端就解析成什么服务器绝对路径”的模型。

原因很简单：

1. 这在本地工具场景下可接受
2. 在服务器上会直接变成越权访问宿主机目录的入口

因此用户与认证设计必须连同以下内容一起收敛：

1. 项目工作目录策略
2. 文件系统访问边界
3. git 操作的 project ownership 校验

### 4.5 WebSocket 不能继续匿名接入

当前系统包含 task realtime 和 project git watcher 能力。

因此一旦引入用户身份：

1. WebSocket 握手必须校验 Harbor session
2. task topic 与 project topic 订阅必须带用户权限判断
3. HTTP 与 WebSocket 必须共享同一套身份语义

## 5. 顶层设计原则

### 5.1 优先做完整闭环，而不是做“半套登录”

第一阶段的正确目标不是“加一个 GitHub 登录按钮”，而是做完以下完整闭环：

1. 用户登录
2. session 持久化
3. 当前用户解析
4. 业务接口授权
5. WebSocket 授权
6. 项目与文件系统边界收口

只做 OAuth callback 而不做后续资源归属，等于没有真正完成部署改造。

### 5.2 先按单服务模型设计，不引入分布式复杂性

当前 Harbor 的部署模型是单服务主导，因此不应为了“理论上的未来扩展”过早引入：

1. 无状态 JWT 主会话
2. 多服务 token introspection
3. 独立 auth service
4. Redis session cluster

第一阶段优先按以下模型落地：

```text
单服务 + 数据库 session + HttpOnly Cookie
```

### 5.3 GitHub 身份与 GitHub 仓库访问必须解耦

第一阶段采用 GitHub 登录，并不等于系统必须持久化 GitHub access token。

应明确区分两类能力：

1. GitHub 作为身份提供方
2. GitHub 作为代码托管访问能力

第一阶段本文只覆盖第一类能力。

如果未来要支持：

1. 导入 GitHub 私有仓库
2. 读取 GitHub PR / issue
3. 以用户身份调用 GitHub API

那应另建 `github-integration` 或等价 supporting module，而不是把这些能力塞进 `auth`。

### 5.4 授权校验优先下沉到 query / repository 边界

第一阶段不建议把授权判断散落在每个 route handler 中。

更合理的方式是：

1. route 负责拿到 `request.auth`
2. use case 负责传递 `actorUserId`
3. repository / query service 负责按用户作用域读取

一句话收敛：

```text
认证在边界层完成，授权在资源读取边界稳定落地。
```

## 6. 模块边界

### 6.1 `user` 模块

`user` 是未来新增 core/supporting 边界中的稳定业务模块，负责：

1. `User` 聚合
2. 用户资料读写
3. 用户状态
4. 当前用户 read model

它不负责：

1. OAuth provider 流程
2. session 创建与解析
3. cookie 管理
4. route guard

### 6.2 `auth` 模块

`auth` 是 future supporting capability，负责：

1. GitHub OAuth start / callback
2. session 创建 / 校验 / revoke
3. 当前请求身份解析
4. 当前 session 查询
5. route-level auth guard

它不负责：

1. 用户业务资料主模型
2. Project ownership
3. Task ownership
4. GitHub 仓库访问功能

### 6.3 `project` 模块

`project` 需要新增的稳定职责如下：

1. `Project.ownerUserId`
2. 项目按用户列举
3. 项目按用户读取
4. 创建项目时绑定 owner

它不负责：

1. GitHub OAuth
2. session 生命周期
3. 当前用户解析

### 6.4 `task / orchestration / document` 模块

这些模块暂不直接拥有 `userId`，而是：

1. 先通过 `projectId` 关联到 `Project`
2. 再由 `Project.ownerUserId` 判断访问权限

这意味着：

1. task-facing query 需要带用户作用域
2. orchestration-facing query 需要带用户作用域
3. document-facing query 需要带用户作用域

### 6.5 `filesystem / git` 模块

这两个 supporting context 在部署版里不再是纯技术能力，而是“带资源权限边界的技术能力”。

它们需要新增的约束是：

1. 所有文件系统访问都必须基于用户可访问的 project
2. 所有 git 操作都必须基于用户可访问的 project
3. 不能再把任意服务器绝对路径当作合法入口

## 7. 身份模型

### 7.1 `User`

第一阶段建议新增 `User` 模型，用来表示 Harbor 内部用户主身份。

建议字段：

1. `id`
2. `githubLogin`
3. `name`
4. `email`
5. `avatarUrl`
6. `status`
7. `lastLoginAt`
8. `createdAt`
9. `updatedAt`

### 7.2 `AuthIdentity`

建议新增 `AuthIdentity`，用来表达：

```text
Harbor 内部用户与外部身份提供方账号之间的映射。
```

建议字段：

1. `id`
2. `userId`
3. `provider`
4. `providerUserId`
5. `providerLogin`
6. `providerEmail`
7. `createdAt`
8. `updatedAt`

第一阶段只有：

1. `provider = github`

这样设计的目的不是“为了抽象而抽象”，而是：

1. 避免把 provider-specific 字段直接塞进 `User`
2. 为未来接入其他身份源保留正常扩展路径

### 7.3 `AuthSession`

建议新增 `AuthSession` 模型，表达 Harbor 自己的登录态。

建议字段：

1. `id`
2. `userId`
3. `tokenHash`
4. `expiresAt`
5. `lastSeenAt`
6. `revokedAt`
7. `createdAt`
8. `userAgent`
9. `ip`

这里的关键判断是：

```text
GitHub access token 不是 Harbor 的主 session。
AuthSession 才是 Harbor 的主登录态。
```

## 8. 授权模型

### 8.1 第一阶段只做 owner-based authorization

第一阶段授权模型统一为：

1. 用户只能访问自己拥有的 project
2. 用户只能访问自己 project 下的 task / orchestration / document / filesystem / git 能力

其核心规则可以表达为：

```text
resource is accessible if and only if
resource.project.ownerUserId === request.auth.userId
```

### 8.2 为什么暂不引入共享与角色

对于当前目标场景，过早引入共享与角色会明显抬高复杂度：

1. 需要新的 membership 模型
2. 需要角色决议
3. 需要更多 query join 与缓存策略
4. 需要重新设计 project create / transfer / invite 流程

而当前真正的部署阻塞点并不是“角色不够多”，而是：

1. 还没有用户身份
2. 还没有会话
3. 还没有资源归属
4. 文件系统和 WebSocket 还没有收口

### 8.3 repository 应按用户作用域提供方法

建议未来 repository / query 接口逐步收敛成如下风格：

1. `listProjectsForUser(userId)`
2. `findProjectForUser(projectId, userId)`
3. `findTaskForUser(taskId, userId)`
4. `listOrchestrationsForUser(projectId, userId)`

而不是让 route 层拿到无作用域资源后再自己判断。

## 9. 会话模型

### 9.1 第一阶段采用数据库 session

第一阶段推荐：

```text
数据库 session + HttpOnly Cookie
```

不推荐直接采用 JWT 作为主会话模型。

理由如下：

1. 当前是单服务，不存在强烈的跨服务无状态校验需求
2. 服务端 session 更容易做主动吊销
3. 更适合后续接入 WebSocket 与后台管理
4. 更适合当前阶段的部署与调试复杂度

### 9.2 Cookie 建议

建议 cookie 策略如下：

1. `HttpOnly`
2. `Secure`
3. `SameSite=Lax`
4. 生产环境下绑定正式域名
5. 设置明确的 `maxAge` 或 `expires`

### 9.3 token 存储策略

建议：

1. 浏览器持有随机 session token
2. 服务端只保存 token hash
3. 数据库中不保存明文 session token

这能降低数据库泄漏时的直接风险。

### 9.4 Session 生命周期

第一阶段建议支持：

1. 登录创建 session
2. 读取当前 session
3. logout 吊销当前 session
4. 过期 session 自动失效

第一阶段不强制要求：

1. 多设备会话管理 UI
2. 全部会话踢出
3. 审计面板

但数据库模型应允许未来自然扩展到这些能力。

## 10. GitHub OAuth 设计

### 10.1 provider 选择

第一阶段建议只支持 GitHub OAuth。

原因如下：

1. 当前团队天然与代码开发环境强相关
2. GitHub 账号通常已经是团队成员的现成身份源
3. 登录门槛低
4. 后续如需扩展 GitHub repo 能力，身份基础已存在

### 10.2 最小 scope

如果第一阶段只做登录，建议 scope 最小化为：

1. `read:user`
2. `user:email`

第一阶段不需要为了登录而申请更高权限。

### 10.3 登录流程

推荐流程如下：

1. 前端访问 `GET /v1/auth/github/start`
2. 后端生成 `state`
3. 后端重定向到 GitHub 授权页
4. GitHub 回调 `GET /v1/auth/github/callback`
5. 后端用 `code` 换 token
6. 后端读取 GitHub 用户信息与邮箱
7. 后端 upsert `User` 与 `AuthIdentity`
8. 后端创建 `AuthSession`
9. 后端写入 Harbor session cookie
10. 后端重定向回 Web 应用

### 10.4 为什么 GitHub token 不应直接作为 Harbor 登录态

如果直接把 GitHub token 视为 Harbor 登录态，会带来以下问题：

1. Harbor 无法独立吊销登录
2. WebSocket 鉴权模型会变复杂
3. logout 语义会依赖外部 provider
4. 审计与 session 管理不稳定

因此应明确：

```text
GitHub token 只用于完成身份校验。
Harbor session 才是 Harbor 内部登录态。
```

### 10.5 允许登录范围

为了匹配“小团队部署”场景，建议必须配置允许范围，而不是允许任意 GitHub 用户登录。

建议至少支持其中一种：

1. `ALLOWED_GITHUB_USERS`
2. `ALLOWED_GITHUB_ORGS`

这样即使服务暴露在公网，也不会变成“任意 GitHub 用户都可尝试进入”的系统。

## 11. API 设计

### 11.1 Auth 路由

第一阶段建议最少提供以下接口：

1. `GET /v1/auth/github/start`
2. `GET /v1/auth/github/callback`
3. `GET /v1/auth/session`
4. `POST /v1/auth/logout`

### 11.2 Session 查询

`GET /v1/auth/session` 的目标是：

1. 给前端初始化登录态
2. 返回当前用户资料
3. 避免前端自行猜测 cookie 是否有效

### 11.3 鉴权中间件

建议新增统一 auth plugin：

1. 从 cookie 中解析 session token
2. 查找 `AuthSession`
3. 加载关联 `User`
4. 向 `request` 注入身份上下文

建议得到的 request 上下文类似：

```ts
type AuthContext = {
  userId: string
  sessionId: string
  user: {
    id: string
    githubLogin: string
    name: string | null
    email: string | null
    avatarUrl: string | null
  }
}
```

### 11.4 公开路由与受保护路由

第一阶段建议划分为两类：

1. 公开路由
2. 需要登录的路由

公开路由包括：

1. `GET /healthz`
2. `GET /v1/auth/github/start`
3. `GET /v1/auth/github/callback`
4. `GET /v1/auth/session` 可以返回已登录或未登录状态

受保护路由包括：

1. `project`
2. `task`
3. `orchestration`
4. `filesystem`
5. `git`
6. 受保护 websocket topic

## 12. 对现有业务模块的影响

### 12.1 `project`

`project` 模块需要新增以下变化：

1. 创建项目时自动绑定 `ownerUserId`
2. 列表查询只返回当前用户项目
3. 详情查询只允许访问当前用户项目
4. 更新、归档、删除都必须校验 owner

### 12.2 `task`

`task` 模块需要新增以下变化：

1. 所有 task query 都应受 project ownership 约束
2. task create 需要确认目标 orchestration / project 属于当前用户
3. task detail 与 task event stream 不能脱离用户 scope 读取

### 12.3 `orchestration`

`orchestration` 模块需要新增以下变化：

1. 所有 orchestration query 都需要 project ownership 约束
2. orchestration bootstrap / create / list 需要带用户作用域

### 12.4 `filesystem`

`filesystem` 模块需要新增以下变化：

1. 不能再通过 project 之外的任意 rootPath 读写服务器文件
2. 所有 filesystem 入口都必须先校验 project ownership
3. bootstrap root 设计需要重新限定为受控目录模型

### 12.5 `git`

`git` 模块需要新增以下变化：

1. 所有 git 操作必须先校验 project ownership
2. git watcher topic 必须按用户权限过滤

## 13. 项目工作目录策略

### 13.1 部署版不能继续沿用“任意 rootPath”

在服务器部署模型中，以下做法应被视为不再成立：

```text
前端提交任意 rootPath，
后端把它 canonicalize 为服务器绝对路径并直接使用。
```

原因如下：

1. 用户可借此访问宿主机任意可读目录
2. 这会绕过 project ownership 的边界意义
3. 文件系统与 git 模块会被动继承这个风险

### 13.2 第一阶段推荐采用受控工作区根目录

建议引入统一配置，例如：

1. `WORKSPACE_ROOT_BASE=/srv/harbor/workspaces`

并约定项目目录只能位于受控根目录下，例如：

```text
/srv/harbor/workspaces/<userId>/<projectSlug>
```

这样做的收益如下：

1. 资源归属清晰
2. 权限边界清晰
3. 文件系统策略更稳定
4. 后续做迁移和备份更清晰

### 13.3 过渡期可接受的导入模式

如果第一阶段确实需要从服务器已有目录导入项目，建议限制在白名单根目录中，例如：

1. `/srv/repos`
2. `/data/projects`

而不是继续允许任意绝对路径。

## 14. WebSocket 鉴权

### 14.1 握手阶段必须校验 Harbor session

第一阶段建议：

1. Socket.IO 握手时读取 cookie
2. 解析 Harbor session
3. 失败则拒绝连接

### 14.2 订阅阶段必须校验资源权限

即使连接已通过认证，订阅阶段仍然需要校验：

1. 该 task 是否属于当前用户可访问 project
2. 该 project git topic 是否属于当前用户

也就是说：

```text
connection authentication
!=
resource authorization
```

## 15. 前端接入约束

### 15.1 HTTP 请求必须支持凭据传递

如果 web 与 service 分域部署，前端请求应显式带凭据：

1. `fetch(..., { credentials: "include" })`

同时服务端 CORS 不能继续无限放开，而应按前端来源域名收敛。

### 15.2 Socket 连接必须支持凭据传递

前端 Socket.IO 连接应显式启用凭据传递。

这样才能让 WebSocket 与 HTTP 共用同一套 session 语义。

### 15.3 前端需要统一的当前用户初始化流程

建议前端应用启动后统一调用：

1. `GET /v1/auth/session`

用于：

1. 判断是否已登录
2. 拉取当前用户资料
3. 决定是否显示登录入口或进入主界面

## 16. 数据库与部署建议

### 16.1 数据库建议

第一阶段虽然可以理论上继续使用 SQLite，但从部署演进角度更推荐直接切到 Postgres。

原因如下：

1. 用户与 session 引入后，数据库将承担更稳定的在线业务职责
2. 后续并发、审计、后台任务与运维操作会更自然
3. 提前迁移成本低于后期迁移

### 16.2 反向代理与 TLS

部署到服务器时应默认要求：

1. TLS
2. 反向代理
3. 正式域名

这不只是运维偏好，也直接关系到：

1. `Secure` cookie 是否可用
2. OAuth callback URL 是否稳定
3. WebSocket 跨域与 cookie 传递是否可靠

### 16.3 第一阶段不强制引入 Redis

在单服务场景下：

1. session 存数据库即可
2. 不必为了“理论上的扩展性”强行加 Redis

## 17. 配置建议

第一阶段建议新增以下配置项：

1. `APP_BASE_URL`
2. `WEB_BASE_URL`
3. `GITHUB_CLIENT_ID`
4. `GITHUB_CLIENT_SECRET`
5. `SESSION_COOKIE_SECRET`
6. `ALLOWED_GITHUB_USERS`
7. `ALLOWED_GITHUB_ORGS`
8. `WORKSPACE_ROOT_BASE`

根据实际部署模型，也可以再补：

1. `COOKIE_DOMAIN`
2. `SESSION_TTL_DAYS`

## 18. 分阶段落地建议

### 18.1 Phase 1: 身份与会话打底

第一阶段应完成：

1. `User / AuthIdentity / AuthSession`
2. GitHub OAuth start / callback
3. Harbor session cookie
4. `GET /v1/auth/session`
5. `POST /v1/auth/logout`

### 18.2 Phase 2: 业务资源接入授权

第二阶段应完成：

1. `Project.ownerUserId`
2. project 路由全面 user-scoped
3. task / orchestration / document 全面 user-scoped
4. filesystem / git 接口接入 ownership 校验

### 18.3 Phase 3: 工作目录模型收口

第三阶段应完成：

1. 受控工作区根目录
2. 取消任意服务器绝对路径输入
3. 迁移或兼容已有本地 rootPath 逻辑

### 18.4 Phase 4: 实时与前端接入收口

第四阶段应完成：

1. WebSocket session 鉴权
2. topic 级授权
3. 前端 session 初始化
4. 前端跨域凭据策略统一

## 19. 非目标

本文明确不覆盖以下能力：

1. 公网开放注册
2. 完整 RBAC
3. 多租户 workspace / organization 模型
4. GitHub 私有仓库访问 token 持久化
5. 细粒度审计后台
6. 容器级用户隔离执行环境

这些能力未来可能需要，但不应阻塞当前“小团队单服务器部署”的主线设计。

## 20. 最终结论

对于 Harbor 当前阶段，正确的方向不是“补一个 GitHub 登录页面”，而是把整个服务收敛成：

```text
GitHub OAuth 负责身份证明，
Harbor session 负责服务登录态，
Project owner 负责资源归属，
filesystem / git / websocket 统一受该归属模型约束。
```

在“自己或受信任小团队的一台服务器”这一目标下，这是当前最小、最完整、也最贴近现有代码架构的设计路径。
