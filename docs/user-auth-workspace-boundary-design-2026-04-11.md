# User Auth Workspace Boundary Design

## 1. 文档信息

- 文档名称：User Auth Workspace Boundary Design
- 日期：2026-04-11
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/user`
  - `apps/service/src/modules/auth`
  - `apps/service/src/modules/workspace`
  - `apps/service/src/routes/v1`
- 关联文档：
  - [./auth-user-service-design-2026-04-01.md](./auth-user-service-design-2026-04-01.md)
  - [./workspace-foundation-requirements-2026-04-06.md](./workspace-foundation-requirements-2026-04-06.md)
  - [./workspace-member-management-requirements-2026-04-10.md](./workspace-member-management-requirements-2026-04-10.md)
  - [./workspace-invitation-requirements-2026-04-10.md](./workspace-invitation-requirements-2026-04-10.md)

## 2. 目标

这份文档只回答一个问题：

```text
user / auth / workspace 的边界应该怎么切。
```

当前代码已经开始向 workspace-first 迁移，但用户身份、认证流程、workspace onboarding 之间仍然比较容易缠在一起。

这份文档的目的不是一次性定义最终身份系统，而是先把当前阶段必须稳定的模块边界钉住。

## 3. 核心结论

### 3.1 `user` 是身份主体模块

`user` 表达 Harbor 内部用户是谁。

它负责：

1. `User` 聚合与用户资料
2. 外部 identity 到 Harbor user 的绑定
3. 用户查找能力
4. 用户身份同步

它不负责：

1. OAuth start / callback 协议
2. session
3. cookie
4. 路由鉴权
5. workspace 业务规则

### 3.2 `auth` 是认证能力模块

`auth` 表达一个请求当前是否已登录 Harbor。

它负责：

1. OAuth provider 接入
2. Harbor session 创建、解析、续期、吊销
3. `request.auth` 注入
4. route 级认证入口

它不负责：

1. `User` 聚合
2. 用户身份绑定规则本身
3. workspace membership
4. workspace invitation

### 3.3 `workspace` 是协作归属模块

`workspace` 表达用户之间的协作边界。

它负责：

1. `Workspace`
2. `Membership`
3. `Invitation`
4. workspace access
5. workspace onboarding 相关业务规则

它不负责：

1. OAuth
2. session
3. provider token
4. GitHub App / repository access

### 3.4 依赖方向必须收敛为

```text
auth -> user
auth -> workspace
workspace -> user
project/task/git/filesystem/orchestration -> workspace
```

不允许出现：

```text
workspace -> auth
user -> auth
workspace 直接拥有 session / OAuth 概念
```

## 4. 模块范围

## 4.1 `user` 模块当前应包含什么

当前阶段 `user` 模块的最小稳定范围是：

1. `User` domain type
2. `UserDirectory`
3. `UserIdentityRegistry`
4. 相关 Prisma / in-memory adapter

建议 public surface 如下：

```ts
User
UserDirectory
UserIdentityRegistry
```

其中：

- `UserDirectory`
  - 面向其他业务模块
  - 例如 workspace 查找 Harbor user
- `UserIdentityRegistry`
  - 面向 auth 或 app-level onboarding flow
  - 例如 GitHub callback 后把 provider identity 同步成 Harbor user

## 4.2 `auth` 模块当前应包含什么

当前阶段 `auth` 模块的最小稳定范围是：

1. OAuth provider client
2. `AuthSessionStore`
3. auth plugin
4. auth routes
5. authenticated request context

建议 public surface 如下：

```ts
authSessionPlugin
requireAuthenticatedRequest
requireAuthenticatedPreHandler
AuthSessionStore
AuthenticatedRequestContext
registerAuthModuleRoutes
```

auth 可以调用 user 和 workspace，但这些调用应被视为“登录成功后的外部编排”，而不是 auth 自己拥有的领域能力。

## 4.3 `workspace` 模块当前应包含什么

当前阶段 `workspace` 模块的最小稳定范围是：

1. `Workspace`
2. `Membership`
3. `WorkspaceInvitation`
4. workspace repository / invitation repository
5. workspace facade
6. workspace routes

workspace 查找用户时，应依赖 `user` 提供的 `UserDirectory`。

它可以基于当前产品约束继续使用 `githubLogin` 作为 invitation 目标字段，但这属于业务模型里的“当前身份来源约束”，不意味着 workspace 依赖 auth。

## 5. 典型交互链路

## 5.1 GitHub 登录

正确链路应是：

```text
auth route
  -> GitHub OAuth client
  -> user identity registry
  -> workspace onboarding facade
  -> auth session store
```

语义上：

1. auth 负责拿到外部身份
2. user 负责把外部身份绑定到 Harbor user
3. workspace 负责处理该 user 的协作上下文
4. auth 最后创建 Harbor session

## 5.2 Workspace 成员管理

正确链路应是：

```text
workspace use case
  -> user directory
  -> workspace repository
```

语义上：

1. workspace 只需要知道“这个 githubLogin 对应哪个 Harbor user”
2. 它不需要知道对方是怎么登录的
3. 它更不应该依赖 auth session 或 OAuth provider

## 6. 当前代码状态判断

截至 2026-04-11，这一轮重构后的状态是：

1. `user` 已经开始具备独立公共面
2. `workspace` 已经改为依赖 `user` 的用户查询能力
3. `auth` 已经把“GitHub identity -> Harbor user” 的逻辑挪到 `user`
4. `auth` 仍然保留登录成功后的 workspace onboarding 编排

这里要明确：

第 4 点目前可以接受，但不应被误读为“workspace 属于 auth”。

它只是因为：

1. 当前登录成功后最自然的触发点就在 auth callback
2. 还没有单独的 app-level onboarding orchestration module

所以：

```text
当前 auth 调用 workspace，
不等于 workspace 依赖 auth。
```

## 7. 当前不做的事

这份文档当前不要求：

1. 把 invitation 从 `githubLogin` 立即改成通用 identity 模型
2. 新建独立的 app-level onboarding module
3. 重做 user domain 的完整 profile / settings / preference 能力
4. 把 auth routes 拆成更多子模块

这些都可以下一轮再做。

## 8. 下一轮重构准绳

后续凡是遇到 user / auth / workspace 边界问题，都按下面这组判断：

1. 这是“用户是谁”的问题，还是“用户是否已登录”的问题。
2. 如果是“用户是谁”，放 `user`。
3. 如果是“是否已登录 / 当前 session”，放 `auth`。
4. 如果是“用户与 workspace 的关系”，放 `workspace`。
5. 如果某段代码既碰 user 又碰 workspace，再问它是不是登录入口上的编排；若是，暂时留在 auth 或未来 app-level orchestration，不塞进 domain。

## 9. 一句话总结

```text
user 表达身份主体，
auth 表达认证壳，
workspace 表达协作归属。
```
