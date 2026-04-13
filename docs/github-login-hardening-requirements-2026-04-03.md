# GitHub Login Hardening Requirements

## 1. 文档信息

- 文档名称：GitHub Login Hardening Requirements
- 日期：2026-04-03
- 状态：Proposed
- 适用范围：
  - `apps/service/src/modules/auth`
  - `apps/web/src/modules/auth`
- 关联文档：
  - [github-oauth-and-github-app-setup-guide-2026-04-02.md](./github-oauth-and-github-app-setup-guide-2026-04-02.md)
  - [auth-user-service-design-2026-04-01.md](./auth-user-service-design-2026-04-01.md)

## 2. 背景

当前 Harbor 已经具备基础的 GitHub OAuth 登录流程，但现有实现还没有达到“可稳定上线”的完成度。

本轮 review 已确认至少存在三类明显缺口：

1. OAuth scope 与实际调用的 GitHub API 不匹配，真实登录在某些账号上可能直接失败
2. 登录流程没有贯通原始 `redirect` 目标，用户登录后会丢失上下文
3. 用户绑定逻辑在部分异常场景下仍信任 `githubLogin`，而不是只信任稳定的 provider identity

同时，当前自动化测试主要只覆盖后端 happy path，缺少对真实边界条件和前端跳转链路的约束。

因此，这个功能不应被视为“只差一点小修小补”，而应当作为一次明确的 hardening 任务处理。

## 3. 目标

本任务只解决 GitHub 登录能力达到可交付状态所需的最小闭环，不扩展到 GitHub App 仓库访问能力，也不重做整个用户系统。

核心目标如下：

1. 让 GitHub OAuth 登录在真实 GitHub scope 约束下稳定可用
2. 让未登录用户完成登录后回到原始目标页面，而不是固定回到首页
3. 让 Harbor 账户绑定只依赖稳定的 GitHub provider identity
4. 为关键登录链路补齐回归测试，避免后续再次被破坏

## 4. 非目标

本轮不处理以下事项：

1. 不引入新的第三方身份提供方
2. 不重做 Harbor session 模型
3. 不扩展 GitHub OAuth 为 repo access 方案
4. 不实现通用的 open redirect 平台能力，范围仅限当前登录流程所需的安全跳转

## 5. 核心问题定义

### 5.1 OAuth scope 与身份拉取流程不一致

当前后端在授权 URL 中只申请：

1. `read:user`
2. `user:email`

但回调阶段又会调用 GitHub `/user/orgs` 接口读取组织信息。

因此，本轮必须做出明确判断并落地：

1. 要么补上登录所需的合法 scope，并保证组织白名单判断在该 scope 下可靠工作
2. 要么取消对 `/user/orgs` 的无条件依赖，并同步调整允许名单能力边界

不允许继续保留“scope 看起来够用，但运行时靠运气”的状态。

### 5.2 登录后必须恢复原始目标页

当前前端已经会在未登录时把目标页编码到 `/login?redirect=...`，但这个值没有被带进 GitHub OAuth 流程，也没有在 callback 成功后被恢复。

因此，本轮必须保证：

1. 登录入口能够把受控的 redirect 信息传递给服务端
2. 服务端能在 OAuth start -> callback 整个链路中保存并验证该 redirect
3. 登录成功后回跳到原始目标页
4. 登录失败时，若回到登录页，也应尽量保留原始 redirect

### 5.3 用户绑定必须以 provider identity 为准

GitHub 登录的稳定身份主键应是 provider user id，而不是可变的 `githubLogin`。

因此，本轮必须保证：

1. 已存在 `authIdentity` 时，只按 `provider + providerUserId` 识别用户
2. 不存在 `authIdentity` 时，不允许仅凭 `githubLogin` 自动接管已有 Harbor 用户
3. 若出现 identity 缺失但 login 撞车的异常情况，系统必须失败并返回结构化错误，而不是静默合并账户

### 5.4 测试覆盖必须升级为回归级别

当前测试主要只覆盖了：

1. OAuth start happy path
2. callback happy path
3. session happy path

但还没有锁住以下关键行为：

1. scope/权限不足时的失败路径
2. redirect 透传与恢复
3. 允许名单判断的边界
4. identity 冲突或绑定异常时的失败语义
5. 前端登录页与鉴权门的跳转恢复行为

## 6. 功能需求

### FR-1 统一并明确 GitHub 登录权限模型

系统必须显式收敛“GitHub 登录需要哪些 scope，以及它们分别支撑什么业务语义”。

要求：

1. 若保留 `allowedGitHubOrgs` 能力，则 OAuth scope 与后续 API 调用必须完全匹配
2. 若 scope 调整会带来更大授权面，文档中必须明确说明原因
3. 若改为无组织信息时禁用 org allowlist，则配置校验与错误信息必须同步更新
4. GitHub API 权限不足时，错误响应必须稳定映射为结构化业务错误，而不是仅暴露上游模糊失败

### FR-2 登录流程必须支持受控 redirect 恢复

要求：

1. `/login?redirect=...` 的目标地址必须能贯通到 GitHub callback 成功回跳
2. redirect 只能是 Harbor Web 内部可接受路径，不允许成为 open redirect
3. redirect 信息必须经过签名态或受信 cookie/state 绑定，不允许仅依赖前端回传
4. 当 redirect 缺失或非法时，系统回退到稳定默认页面

### FR-3 登录失败时保留足够的恢复上下文

要求：

1. callback 失败回到登录页时，前端仍能展示结构化错误信息
2. 若原始 redirect 合法，失败回到登录页时应继续保留该 redirect
3. 用户再次点击 “Sign in with GitHub” 后，不需要重新访问原始页面来恢复上下文

### FR-4 用户绑定必须只信任稳定 identity

要求：

1. `providerUserId` 是 Harbor 识别 GitHub 用户的唯一稳定外部身份
2. `githubLogin` 只作为展示字段和辅助查询字段，不得作为自动绑定依据
3. 当数据库中出现“已有同 login 用户，但不存在匹配 identity”的情况时，必须返回受控错误
4. 错误文案应能让开发者定位为数据冲突或绑定异常，而不是误导成普通登录失败

### FR-5 保持现有 session 行为不回退

要求：

1. 登录成功后仍创建 Harbor 自己的 session cookie
2. `/v1/auth/session` 与 `/v1/auth/logout` 的现有 contract 不应被破坏
3. 前后端跨域部署场景下，登录成功后的会话恢复行为必须继续可用

## 7. 安全与边界要求

### 7.1 redirect 安全边界

必须明确：

1. 只接受站内相对路径，或经过严格校验的同源路径
2. 拒绝 `http://`、`https://`、`//example.com` 这类外部目标
3. 拒绝明显危险的协议或格式
4. callback 成功与失败都必须复用同一套 redirect 校验逻辑

### 7.2 身份冲突边界

必须明确：

1. 不允许把未知 GitHub 身份静默并到已有 Harbor 用户
2. identity 冲突属于服务端可观测问题，应记录明确日志
3. 若后续需要数据修复，应通过显式后台修复，而不是登录时自动猜测

## 8. 测试要求

### 8.1 后端测试

至少补齐以下测试：

1. GitHub OAuth start 在需要 org allowlist 时生成正确授权参数
2. callback 在 scope/权限不足或 GitHub API 返回失败时，返回稳定错误
3. redirect 从 start 到 callback 成功完整恢复
4. redirect 非法时回退默认页面
5. 存在 login 撞车但 identity 不匹配时，登录失败而不是账户合并
6. org/user allowlist 的允许与拒绝场景

### 8.2 前端测试

至少补齐以下测试：

1. `AuthGate` 在未登录时跳转到 `/login` 并携带当前路径
2. `LoginPage` 点击登录时会启动可恢复 redirect 的登录链路
3. 登录后会导航回 `redirectTo`
4. 401 或 `AUTH_REQUIRED` 场景下，从错误页重新登录后不会丢失目标页

## 9. 建议实现顺序

### Step 1

先收敛 GitHub OAuth 权限模型与 allowlist 语义，避免在错误的授权假设上继续开发。

### Step 2

补服务端 redirect 透传与校验机制，并为成功/失败回跳建立稳定 contract。

### Step 3

重构 `upsertGitHubUser` 绑定逻辑，移除对 `githubLogin` 的自动接管行为。

### Step 4

补齐后端 route / store 测试，锁住异常路径与冲突路径。

### Step 5

补齐前端 `AuthGate` / `LoginPage` / `AuthErrorPage` 交互测试。

## 10. 验收标准

在本任务完成后，以下条件必须全部满足：

1. 使用真实 GitHub 账号登录时，不会因为 scope 与 API 不匹配而在 callback 阶段随机失败
2. 用户访问受保护页面后登录，成功后会回到原始页面
3. 登录失败再试一次时，不需要重新手动导航回原始页面
4. 系统不会因为 `githubLogin` 撞车而错误合并 Harbor 用户
5. 关键异常路径均有自动化测试覆盖

## 11. 建议任务标题

如果后续要转成 GitHub issue，建议标题使用：

`harden GitHub login flow: scope alignment, redirect restore, and identity-safe binding`
