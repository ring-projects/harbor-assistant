# GitHub Login Hardening TDD Plan

## 1. 文档信息

- 文档名称：GitHub Login Hardening TDD Plan
- 日期：2026-04-03
- 状态：Proposed
- 适用范围：
  - `apps/service/src/modules/auth`
  - `apps/web/src/modules/auth`
- 关联文档：
  - [../github-login-hardening-requirements-2026-04-03.md](../github-login-hardening-requirements-2026-04-03.md)
  - [../github-oauth-and-github-app-setup-guide-2026-04-02.md](../github-oauth-and-github-app-setup-guide-2026-04-02.md)
  - [../auth-user-service-design-2026-04-01.md](../auth-user-service-design-2026-04-01.md)

## 2. 目标

这份文档只规划 GitHub 登录 hardening 如何按测试驱动方式推进。

本轮目标不是泛化整个认证系统，而是先把这条登录链路补成稳定闭环：

1. OAuth scope 与后续 GitHub API 调用一致
2. 登录前的目标页能在 callback 后恢复
3. 登录失败时保留足够上下文，方便用户重试
4. Harbor 账户绑定只依赖稳定的 GitHub provider identity
5. 前后端都有回归测试锁住关键行为

## 3. TDD 总原则

推荐顺序：

1. service route tests
2. service auth store tests
3. web auth component tests
4. composition / integration smoke tests

这里优先 route tests，而不是先改 store 或前端，是因为本次最容易返工的是登录 contract 本身：

1. OAuth start 需要接收什么输入
2. callback 如何恢复 redirect
3. 失败时回哪个页面、带哪些参数
4. identity 冲突时返回什么错误

先把这些行为锁住，再改内部实现，返工会更少。

## 4. 测试分层

### 4.1 Service route tests

这一层验证：

1. `/v1/auth/github/start` 的授权参数
2. `/v1/auth/github/callback` 的成功与失败回跳
3. session cookie 与 state/redirect cookie 行为
4. allowlist 与结构化错误映射

这一层不验证：

1. React 页面导航
2. Prisma 细节
3. GitHub 真实网络调用

### 4.2 Service store tests

这一层验证：

1. GitHub identity 绑定策略
2. identity 缺失时的冲突处理
3. session 创建与读取不回退

这一层不验证：

1. Fastify route wiring
2. 前端跳转

### 4.3 Web auth tests

这一层验证：

1. `AuthGate` 对未登录场景的 redirect 构造
2. `LoginPage` 对 redirect 与 error 的呈现
3. 已登录后的回跳导航
4. `AuthErrorPage` 在 401 场景下的重登录恢复链路

### 4.4 Composition tests

这一层只做最小联通验证：

1. auth module 接线没有被破坏
2. callback 成功后仍能通过 `/v1/auth/session` 读到登录态

## 5. 第一批红灯测试

建议第一批先写以下失败测试。

### 5.1 OAuth scope / allowlist 相关

先写：

1. 当配置了 `allowedGitHubOrgs` 时，`/v1/auth/github/start` 会生成满足组织查询语义的授权参数
2. 当 GitHub 返回权限不足或组织查询失败时，callback 会回到登录页并附带稳定错误码
3. 当用户不在 `allowedGitHubUsers` 且不在 `allowedGitHubOrgs` 中时，callback 返回 `PERMISSION_DENIED`
4. 当用户命中 user allowlist 时，即使 org 列表为空也能通过

### 5.2 Redirect 恢复相关

先写：

1. `/v1/auth/github/start?redirect=/projects/abc` 会把 redirect 通过受控方式带入后续 callback
2. callback 成功后跳回 `/projects/abc`
3. callback 失败后跳回 `/login?error=...&redirect=...`
4. 非法 redirect 会被丢弃并回退默认页

### 5.3 Identity 安全绑定相关

先写：

1. 已存在 `provider + providerUserId` 时会更新同一用户资料
2. 不存在 identity 且不存在同 login 用户时会创建新用户与新 identity
3. 不存在 identity 但存在同 login 用户时会失败，而不是合并账户
4. 已有 identity 时，即使 login 发生变化，仍然绑定到原用户

### 5.4 前端跳转相关

先写：

1. `AuthGate` 未登录时跳转到 `/login?redirect=<当前路径>`
2. `LoginPage` 已登录时会导航到 `redirectTo`
3. `LoginPage` 在存在 errorCode 时会显示正确错误消息
4. `AuthErrorPage` 遇到 401 时会跳登录页，并保留原始 redirect

## 6. 绿灯实现顺序

### Step 1

先锁定 `/auth/github/start` 与 `/auth/github/callback` 的 contract：

1. redirect 输入
2. state/redirect 存储
3. 成功回跳
4. 失败回跳

### Step 2

再锁定 allowlist 与 GitHub scope 行为：

1. scope 参数
2. `/user/orgs` 依赖是否保留
3. GitHub API 失败到 Harbor error code 的映射

### Step 3

再重构 `PrismaAuthStore.upsertGitHubUser` 的 identity 绑定策略：

1. provider identity happy path
2. login 冲突失败路径
3. login 变更更新路径

### Step 4

最后补前端组件测试与最小联通测试。

## 7. 详细测试清单

### 7.1 Service route checklist

- [ ] `GET /v1/auth/github/start` 在未配置 GitHub OAuth 时返回 `AUTH_NOT_CONFIGURED`
- [ ] `GET /v1/auth/github/start` 生成正确的 `client_id`
- [ ] `GET /v1/auth/github/start` 生成正确的 `redirect_uri`
- [ ] `GET /v1/auth/github/start` 生成满足当前 allowlist 语义的 `scope`
- [ ] `GET /v1/auth/github/start` 写入短期 state cookie
- [ ] `GET /v1/auth/github/start?redirect=/projects/p1` 会保存 redirect 恢复信息
- [ ] `GET /v1/auth/github/start?redirect=https://evil.example` 会拒绝外部 redirect
- [ ] `GET /v1/auth/github/callback` 在缺少 `code` 时返回 `AUTH_CALLBACK_FAILED`
- [ ] `GET /v1/auth/github/callback` 在缺少 `state` 时返回 `AUTH_CALLBACK_FAILED`
- [ ] `GET /v1/auth/github/callback` 在 state 不匹配时返回 `AUTH_CALLBACK_FAILED`
- [ ] `GET /v1/auth/github/callback` 成功时创建 Harbor session cookie
- [ ] `GET /v1/auth/github/callback` 成功时清理 OAuth state cookie
- [ ] `GET /v1/auth/github/callback` 成功时恢复合法 redirect
- [ ] `GET /v1/auth/github/callback` 成功时在无 redirect 场景回到默认页
- [ ] `GET /v1/auth/github/callback` 失败时跳回登录页并携带 `error`
- [ ] `GET /v1/auth/github/callback` 失败时若 redirect 合法则保留 `redirect`
- [ ] `GET /v1/auth/github/callback` 在用户命中 allowlist 时允许登录
- [ ] `GET /v1/auth/github/callback` 在用户不命中 allowlist 时返回 `PERMISSION_DENIED`
- [ ] `GET /v1/auth/github/callback` 在 GitHub API 权限不足时返回稳定错误，而不是 500 模糊失败
- [ ] `GET /v1/auth/session` 在登录成功后返回 `authenticated: true`
- [ ] `POST /v1/auth/logout` 仍能清除 session 且不受本轮改动影响

### 7.2 Service store checklist

- [ ] `upsertGitHubUser` 首次登录会创建 `User` 与 `AuthIdentity`
- [ ] `upsertGitHubUser` 再次登录同一 `providerUserId` 会更新原用户
- [ ] `upsertGitHubUser` 在同一 identity 下 login 变化时只更新展示字段
- [ ] `upsertGitHubUser` 在没有 identity 且没有 login 冲突时创建新用户
- [ ] `upsertGitHubUser` 在没有 identity 但 login 已被其他用户占用时失败
- [ ] `createSession` 与 `getSessionByToken` 现有 happy path 不回退
- [ ] `revokeSessionByToken` 现有 happy path 不回退

### 7.3 Web checklist

- [ ] `AuthGate` 未登录时带上 `pathname + search + hash`
- [ ] `AuthGate` 已登录时不跳登录页
- [ ] `LoginPage` loading 时展示检查 session 状态
- [ ] `LoginPage` 已登录且存在 `redirectTo` 时导航回 `redirectTo`
- [ ] `LoginPage` 已登录且无 `redirectTo` 时导航到默认页
- [ ] `LoginPage` 能展示 `AUTH_CALLBACK_FAILED` 错误提示
- [ ] `LoginPage` 能展示 `PERMISSION_DENIED` 错误提示
- [ ] `LoginPage` 能展示 `AUTH_NOT_CONFIGURED` 错误提示
- [ ] 登录入口会启动包含 redirect 恢复能力的登录链路
- [ ] `AuthErrorPage` 在 401 / `AUTH_REQUIRED` 时跳到 `/login`
- [ ] `AuthErrorPage` 在 401 / `AUTH_REQUIRED` 时不会丢失目标页

### 7.4 Smoke / integration checklist

- [ ] auth module 注册后，start -> callback -> session 的最小 happy path 仍然打通
- [ ] 引入 redirect 能力后，不会破坏原本无 redirect 的登录路径
- [ ] 引入 identity 冲突保护后，不会破坏已有正常用户登录路径

## 8. 建议测试文件落点

建议按以下位置落测试：

```text
apps/service/src/modules/auth/routes/
  auth.routes.test.ts

apps/service/src/modules/auth/infrastructure/
  prisma-auth-store.test.ts
  github-oauth-client.test.ts

apps/web/src/modules/auth/components/
  auth-gate.test.tsx
  login-page.test.tsx
  auth-error-page.test.tsx
```

如果你希望把 redirect 行为从 route test 中进一步拆开，也可以单独补：

```text
apps/service/src/modules/auth/routes/
  auth.redirect.routes.test.ts
```

## 9. 建议开发批次

### Batch 1

只做 service route 红灯：

1. scope
2. redirect
3. callback 错误映射

### Batch 2

只做 auth store 红灯：

1. identity 更新
2. login 冲突失败

### Batch 3

只做前端 auth 红灯：

1. `AuthGate`
2. `LoginPage`
3. `AuthErrorPage`

### Batch 4

补 smoke 测试并清理重复实现。

## 10. 完成标准

这份测试清单完成后，意味着：

1. GitHub 登录核心 contract 已被测试锁住
2. redirect 恢复不会再被随手改坏
3. identity 绑定不会再偷偷退化成按 `githubLogin` 猜用户
4. 后续即使继续重构 auth 模块，也有明确回归护栏
