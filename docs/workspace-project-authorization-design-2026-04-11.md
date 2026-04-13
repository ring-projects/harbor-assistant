# Workspace Project Authorization Design

## 1. 文档信息

- 文档名称：Workspace Project Authorization Design
- 日期：2026-04-11
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/authorization`
  - `apps/service/src/modules/workspace`
  - `apps/service/src/modules/project`
  - `apps/service/src/modules/task`
  - `apps/service/src/modules/orchestration`
  - `apps/service/src/modules/filesystem`
  - `apps/service/src/modules/git`
  - `apps/service/src/modules/interaction`
  - `apps/service/src/routes/v1`
- 关联文档：
  - [./workspace-foundation-requirements-2026-04-06.md](./workspace-foundation-requirements-2026-04-06.md)
  - [./workspace-member-management-requirements-2026-04-10.md](./workspace-member-management-requirements-2026-04-10.md)
  - [./workspace-github-integration-requirements-2026-04-06.md](./workspace-github-integration-requirements-2026-04-06.md)
  - [./user-auth-workspace-boundary-design-2026-04-11.md](./user-auth-workspace-boundary-design-2026-04-11.md)

## 2. 背景

Harbor 已经完成了两件重要的事：

1. `workspace` 成为新的协作归属边界
2. `project` 及其子资源开始通过 workspace membership 继承访问控制

但当前授权实现仍停留在过渡阶段：

1. `project-access` 只表达“是否可访问项目”
2. 它被进一步复用于项目的读取、修改、删除、settings 修改、GitHub binding、workspace provision、workspace sync
3. `task / orchestration / filesystem / git` 仍主要通过 project-scoped adapter 间接继承权限
4. websocket realtime 通道没有纳入同一套认证授权边界

这套实现能支撑 workspace-first 的第一步，但已经不足以支撑当前产品形态。

当前最关键的缺口不是“缺少更多 if”，而是缺少一层统一的授权语义：

```text
谁
对
哪个资源
能做什么动作
```

## 3. 本轮目标

本轮目标是引入一个独立的授权层，使 Harbor 从“可见性过滤”进入“动作级授权”阶段。

本轮要求：

1. 新增独立 `authorization` 模块
2. 统一抽象 `actor + resource + action -> decision`
3. 让 HTTP route、websocket、project-scoped facade 使用同一套授权入口
4. 区分 `view`、`update`、`delete`、`settings.update`、`files.write`、`git.subscribe` 等动作
5. 保留 `workspace` 和 `project` 对业务真相的拥有权，不把事实搬进权限模块
6. 为后续 project 级策略、更多 workspace 角色、审计与 capability 扩展留下空间

一句话总结：

```text
workspace/project 保留事实，
authorization 独立解释这些事实，
所有入口统一调用 authorization。
```

## 4. 本轮不做

为了避免把“授权层”直接做成一个过重的权限中心，本轮明确不做：

1. 不做独立的全局 policy 管理后台
2. 不做复杂通用 ABAC 表达式引擎
3. 不做跨资源的自定义 DSL
4. 不做 project 级 ACL 持久化
5. 不做 `admin`、`billing_admin`、`security_admin` 等更多 workspace 角色
6. 不做 provider-agnostic integration policy 平台

如果未来 Harbor 真有这类复杂需求，再在 `authorization` 模块之上演进 policy storage，而不是现在抢跑。

## 5. 核心结论

### 5.1 不建议现在做“大权限中心”

当前阶段最合适的形态不是一个自己维护所有资源镜像的“权限中心”，而是一个独立的授权模块：

```text
workspace 提供 membership / role 真相
project 提供 project ownership / source / workspaceId 真相
task / orchestration 提供自身归属真相
authorization 基于这些真相计算 permission decision
```

原因很直接：

1. Harbor 还处在边界收敛期，业务事实仍在快速稳定
2. 如果现在把资源事实也迁进权限中心，只会制造第二套主数据
3. 当前真正缺的是统一授权入口，不是独立资源仓库

### 5.2 授权必须是动作级，而不是“是否看得到”

当前 `active membership => 可以访问 workspace 下所有 project` 这条规则，在 foundation 阶段是对的，但现在已经不够。

因为当前产品里已经出现：

1. project settings
2. repository binding
3. provision workspace
4. sync workspace
5. filesystem write
6. git write
7. realtime subscribe

这些动作显然不该继续被压扁成同一个 `canAccessProject`。

### 5.3 所有入口都必须走同一套授权边界

授权不能只存在于 HTTP route。

本轮必须覆盖：

1. REST route
2. websocket subscribe / snapshot / stream
3. project-scoped facade
4. integration orchestration

否则只会出现：

```text
HTTP 看起来安全，
但 realtime 或 facade 继续绕过。
```

## 6. 当前问题判断

截至 2026-04-11，当前权限实现存在以下结构性问题：

### 6.1 `project-access` 把“可见”和“可改”混在一起

当前 `project-access` 的语义本质上是：

```text
这个用户能不能通过 project 找到东西
```

但现在它被用于：

1. project read
2. project update
3. project archive / restore / delete
4. project settings read / update
5. repository binding read / write
6. provision workspace
7. sync workspace

这会导致普通 member 和 owner 在很多 project 管理动作上没有区分。

### 6.2 websocket 绕开了 HTTP 授权边界

当前 realtime gateway 直接挂在根 `app` 上，且 task/project-git 订阅路径没有用户上下文注入，也没有显式 authorization check。

这不是“实现还不够优雅”的问题，而是明确的授权洞。

### 6.3 资源存在性与权限失败语义没有统一收口

当前很多路径通过“拿不到被裁剪后的 project/task repository 结果”表现为 `404`。

这种行为在“非成员不可见”时是合理的，但在“成员可见但无管理权限”时，就需要明确区分：

1. `not found`
2. `permission denied`

这类错误语义不能继续分散在 route 内部或 repository wrapper 行为里。

### 6.4 integration 行为继续挤在 project route 中

project route 现在既处理 project 事实，也处理 installation access、repository binding、workspace provision/sync。

这不是立即要拆掉的 bug，但如果不先引入统一授权层，后续这些 integration 动作只会继续在 project route 内堆更多 role 判断。

## 7. 设计原则

### 7.1 授权模块只负责 decision，不负责业务真相

`authorization` 模块负责：

1. 定义 action
2. 定义 decision model
3. 定义 query port
4. 根据资源事实做判断

它不负责：

1. 保存 membership
2. 保存 project
3. 保存 task
4. 替代 workspace/project 的 repository

### 7.2 授权入口必须显式表达 action

不要继续依赖这种隐式语义：

```ts
createAccessibleProjectRepository(...)
```

应该显式表达：

```ts
authorize({
  actorUserId,
  action: "project.settings.update",
  resource: { kind: "project", projectId },
})
```

这样 route、socket、facade 才能共用同一套判断。

### 7.3 project 子资源权限仍然以 project 为主要传播边界

本轮不要求 task、filesystem、git、orchestration 直接依赖 workspace。

推荐保持：

```text
task/filesystem/git/orchestration
  -> resource relation
  -> project
  -> workspace membership / role
```

这样可以继续保留当前项目执行上下文的稳定性。

### 7.4 授权只回答“能否做”，业务状态继续由领域模块负责

授权层不应该替代领域状态机。

例如：

1. 用户是否能执行 `project.workspace.provision` 由 authorization 回答
2. project 当前是否已经 provisioned 由 project/integration 领域规则回答

也就是说：

```text
authorization 决定 actor 是否有资格，
domain 决定当前资源状态是否允许。
```

### 7.5 “隐藏资源存在性”应成为显式策略

授权层必须能表达：

1. 资源对当前 actor 完全不可见
2. actor 知道资源存在，但不允许做该动作

否则 route 层会继续靠“找不到对象”偶然实现 404。

## 8. 模块边界

## 8.1 `authorization` 模块负责什么

建议新增：

```text
apps/service/src/modules/authorization/
```

它负责：

1. `AuthorizationAction`
2. `AuthorizationResource`
3. `AuthorizationDecision`
4. `AuthorizationService`
5. 资源关系查询 ports
6. 默认策略 evaluator
7. 统一的 deny/error mapping helper

## 8.2 `workspace` 模块继续负责什么

`workspace` 继续拥有：

1. `Workspace`
2. `Membership`
3. `role`
4. `status`
5. owner/member 管理规则

授权模块只消费这些事实，不反向拥有它们。

## 8.3 `project` 模块继续负责什么

`project` 继续拥有：

1. project identity
2. `workspaceId`
3. `ownerUserId`
4. source / settings / lifecycle
5. project 是否有 workspace root

授权模块只消费这些事实。

## 8.4 其他模块如何接入

`task / orchestration / filesystem / git / interaction` 不直接实现自己的权限模型。

它们只负责：

1. 提供资源归属查询
2. 调用 `authorization`
3. 在授权通过后继续自己的业务逻辑

## 9. 授权模型

### 9.1 Actor

本轮 actor 先只支持 Harbor authenticated user，预留 system actor。

建议模型：

```ts
type AuthorizationActor =
  | {
      kind: "user"
      userId: string
    }
  | {
      kind: "system"
      systemId: string
    }
```

当前绝大多数入口使用：

```ts
{ kind: "user", userId: request.auth!.userId }
```

### 9.2 Resource

建议先支持：

```ts
type AuthorizationResource =
  | { kind: "workspace"; workspaceId: string }
  | { kind: "project"; projectId: string }
  | { kind: "task"; taskId: string }
  | { kind: "orchestration"; orchestrationId: string }
```

注意：

1. `filesystem` 和 `git` 先不作为独立资源类型
2. 它们仍视为 project-scoped action
3. `create` 类动作不以“尚未存在的目标资源”作为 resource，而以父资源作为 resource

### 9.3 Action

建议第一版动作清单如下。

#### Workspace actions

- `workspace.view`
- `workspace.members.read`
- `workspace.members.manage`
- `workspace.invitations.read`
- `workspace.invitations.manage`
- `workspace.integrations.github.read`
- `workspace.integrations.github.manage`

#### Project actions

- `project.view`
- `project.create`
- `project.update`
- `project.archive`
- `project.restore`
- `project.delete`
- `project.settings.read`
- `project.settings.update`
- `project.repository_binding.read`
- `project.repository_binding.write`
- `project.workspace.provision`
- `project.workspace.sync`

#### Project child capability actions

- `project.files.read`
- `project.files.write`
- `project.git.read`
- `project.git.write`
- `project.git.subscribe`
- `project.tasks.read`
- `project.tasks.create`

#### Task actions

- `task.view`
- `task.update`
- `task.cancel`
- `task.resume`
- `task.delete`
- `task.events.read`
- `task.subscribe`

#### Orchestration actions

- `orchestration.view`
- `orchestration.create`
- `orchestration.task.create`

补充约束：

1. `project.create` 以 `workspace` 作为 resource 判断
2. `project.tasks.create` 以 `project` 作为 resource 判断
3. `orchestration.create` 以 `project` 作为 resource 判断
4. `orchestration.task.create` 以 `orchestration` 作为 resource 判断

### 9.4 Decision

建议 decision 必须显式区分允许、拒绝、拒绝方式。

```ts
type AuthorizationDecision =
  | {
      effect: "allow"
      actor: AuthorizationActor
      action: AuthorizationAction
      resource: AuthorizationResource
    }
  | {
      effect: "deny"
      actor: AuthorizationActor
      action: AuthorizationAction
      resource: AuthorizationResource
      reason:
        | "resource_not_found"
        | "resource_not_visible"
        | "permission_denied"
        | "actor_invalid"
      httpStatus: 401 | 403 | 404
    }
```

这里的重点不是类型长什么样，而是：

```text
404 和 403 必须由 authorization 显式决定，
而不是由 repository wrapper 偶然决定。
```

## 10. 默认授权规则

本轮不引入独立 policy storage，规则直接在 `authorization` 模块内实现。

### 10.1 Workspace

- active `owner`
  - 可读 workspace
  - 可管理成员
  - 可管理 invitation
  - 可管理 workspace-scoped GitHub integration
- active `member`
  - 可读 workspace
  - 可读成员列表
  - 不可管理成员
  - 不可管理 invitation
  - 可读 workspace-scoped integration
  - 不可管理 workspace-scoped integration
- 非 active member
  - workspace 对其不可见

### 10.2 Project

- workspace `owner`
  - 允许全部 project 管理动作
- workspace `member`
  - 允许 `project.view`
  - 允许 `project.settings.read`
  - 允许 `project.files.read`
  - 允许 `project.git.read`
  - 允许 `project.git.subscribe`
  - 允许 `project.tasks.read`
  - 允许创建 task / orchestration
  - 不允许 `project.delete`
  - 不允许 `project.settings.update`
  - 不允许 `project.repository_binding.write`
  - 不允许 `project.workspace.provision`
  - 不允许 `project.workspace.sync`
  - 不允许 project-level destructive git/file write 动作
- 非成员
  - project 对其不可见

### 10.3 Legacy project fallback

对于尚未完全迁移到 workspace 的历史 project：

- `ownerUserId === actorUserId`
  - 允许全部 project 管理动作
- `ownerUserId !== actorUserId`
  - 资源不可见

这个 fallback 只是兼容策略，不是长期归属模型。

### 10.4 Task / Orchestration

task/orchestration 不单独定义 workspace role。

默认规则：

1. 先解析其归属 project
2. 再把动作映射成对应的 project 权限

例如：

- `task.view` -> 至少要求 `project.tasks.read`
- `task.resume` -> 至少要求 `project.tasks.create`
- `task.events.read` -> 至少要求 `project.tasks.read`
- `task.subscribe` -> 至少要求 `project.tasks.read`

## 11. Query Ports

授权模块需要最小事实查询口，而不是直接依赖全量 repository 细节。

建议 ports 如下。

### 11.1 Workspace membership query

```ts
interface AuthorizationWorkspaceQuery {
  getWorkspaceAccessContext(workspaceId: string, actorUserId: string): Promise<{
    workspaceId: string
    exists: boolean
    membership: null | {
      role: "owner" | "member"
      status: "active" | "removed"
    }
  }>
}
```

### 11.2 Project relation query

```ts
interface AuthorizationProjectQuery {
  getProjectAuthorizationContext(projectId: string): Promise<null | {
    projectId: string
    ownerUserId: string | null
    workspaceId: string | null
    status: "active" | "archived" | "missing"
    sourceType: "rootPath" | "git"
    hasWorkspaceRoot: boolean
  }>
}
```

### 11.3 Task relation query

```ts
interface AuthorizationTaskQuery {
  getTaskAuthorizationContext(taskId: string): Promise<null | {
    taskId: string
    projectId: string
    orchestrationId: string
  }>
}
```

### 11.4 Orchestration relation query

```ts
interface AuthorizationOrchestrationQuery {
  getOrchestrationAuthorizationContext(orchestrationId: string): Promise<null | {
    orchestrationId: string
    projectId: string
  }>
}
```

这些 port 的重点是：

1. 只暴露 authorization 需要的事实
2. 不把 route、Prisma、domain error 细节耦合进来
3. 不让 authorization 直接拿着全量 repository 到处查询

## 12. Authorization Service Interface

建议公共入口如下：

```ts
interface AuthorizationService {
  authorize(input: {
    actor: AuthorizationActor
    action: AuthorizationAction
    resource: AuthorizationResource
  }): Promise<AuthorizationDecision>
}
```

同时提供一个更适合 route/facade 使用的 helper：

```ts
async function requireAuthorized(input: {
  actor: AuthorizationActor
  action: AuthorizationAction
  resource: AuthorizationResource
}): Promise<void>
```

它负责：

1. 调用 `authorize`
2. 在 `deny` 时抛出标准 `AppError`
3. 统一映射 401 / 403 / 404

这样 route/socket/facade 不再自己拼授权错误。

## 13. 入口接入方式

## 13.1 HTTP Route

推荐模式：

```ts
await authorization.requireAuthorized({
  actor: { kind: "user", userId: request.auth!.userId },
  action: "project.settings.update",
  resource: { kind: "project", projectId: request.params.id },
})

const project = await updateProjectSettingsUseCase(...)
```

这里要强调：

1. route 先做 authn
2. route 再做 authz
3. 通过后才进入 use case

不要再靠“传一个 accessible repository 进去看看能不能拿到数据”。

## 13.2 WebSocket

websocket 必须接入与 HTTP 同等的 actor 解析与授权检查。

建议规则：

1. 建立 socket 连接时解析 session
2. 把 `actorUserId` 绑定到 socket session
3. 每次 `interaction:subscribe` 都先做 authorization
4. snapshot 与 stream 共用同一套 decision

对应动作映射建议：

- `task` topic -> `task.view`
- `task-events` topic -> `task.events.read`
- `project-git` topic -> `project.git.subscribe`

### 13.3 Project-scoped facade

像 project git watcher、task interaction query 这类 facade 不应直接依赖裸 repository。

它们应当：

1. 接收 actor
2. 调用 authorization
3. 通过后再解析底层 project/task 事实

## 13.4 Integration orchestration

像 repository binding、workspace provision、workspace sync 这类 integration 行为，不应该把授权逻辑留在 project route 的局部 if 中。

推荐动作：

- `project.repository_binding.read`
- `project.repository_binding.write`
- `project.workspace.provision`
- `project.workspace.sync`

这些动作统一由 authorization 决策，再进入 integration use case。

## 14. 对现有代码结构的影响

### 14.1 `createAccessibleProjectRepository` 不再作为长期模式

这个 adapter 在 workspace foundation 阶段是有价值的，但不应继续作为 Harbor 的最终授权模型。

它的问题不是“实现错了”，而是语义太粗。

后续它应逐步退化为：

1. 过渡兼容层
2. 或只用于 list/read 场景的可见性过滤

而不再承担管理动作授权。

### 14.2 project routes 会更清晰

引入 authorization 后，project route 会收敛成：

1. 认证
2. 授权
3. 调用 use case
4. 返回响应

而不是：

1. 构造各种 scoped repository
2. 依赖 repository 行为间接表达授权
3. 在 GitHub route 内继续拼更多局部权限判断

### 14.3 interaction 会被正式纳入同一权限边界

这是本轮最重要的结构收益之一。

如果这一步不做，后续无论 project/task route 权限写得多漂亮，realtime 仍然是旁路。

## 15. 迁移方案

建议按下面顺序落地。

### Phase 1: 建模块，不改业务策略

目标：

1. 新增 `authorization` 模块
2. 定义 action/resource/decision/ports
3. 实现与当前行为等价的默认 evaluator

此阶段先不改变“member 是否可改 settings”等策略，只把授权入口统一出来。

### Phase 2: 先封住 websocket

目标：

1. socket 连接接入 authenticated actor
2. 所有 subscribe/snapshot 走 authorization
3. 修复当前 realtime 旁路问题

这是优先级最高的一步。

### Phase 3: project routes 改成显式 authorize

目标：

1. project core routes 改用 `requireAuthorized`
2. project settings routes 改用 `requireAuthorized`
3. project GitHub routes 改用 `requireAuthorized`

此阶段开始真正把 `view` 和 `manage` 分开。

### Phase 4: child resource routes 改造

目标：

1. filesystem routes 显式使用 `project.files.read/write`
2. git routes 显式使用 `project.git.read/write`
3. task routes 显式使用 `task.*`
4. orchestration routes 显式使用 `orchestration.*`

### Phase 5: 移除旧授权 wrapper 的主路径地位

目标：

1. `createAccessibleProjectRepository` 不再承载写权限
2. `createAccessibleTaskRepository` 不再作为 task 管理动作的唯一保护层
3. 仅保留必要兼容用途，或彻底删除

## 16. 测试要求

本轮至少应新增以下测试维度。

### 16.1 Authorization unit tests

覆盖：

1. owner/member/non-member
2. workspace project 与 legacy project
3. `404` 与 `403` 区分
4. action matrix

### 16.2 Route integration tests

覆盖：

1. member 可读 project
2. member 不可改 project settings
3. member 不可删 project
4. owner 可 provision/sync/bind repository
5. member 不可 provision/sync/bind repository

### 16.3 WebSocket integration tests

覆盖：

1. 未认证 socket 不可订阅
2. 非成员不可订阅 task / project-git
3. member 可订阅被允许的 topic
4. member 不可订阅超出权限的 topic

## 17. 验收标准

本轮完成的标准：

1. Harbor 存在独立 `authorization` 模块
2. 授权统一表达为 `actor + resource + action -> decision`
3. REST route 不再依赖 repository wrapper 间接表达全部授权
4. websocket 被纳入与 HTTP 相同的授权边界
5. workspace owner 与 member 在 project 管理动作上开始被区分
6. legacy project 仍可兼容工作

## 18. 一句话总结

```text
现在应该开始做权限系统，
但应该做成独立授权层，
而不是脱离 workspace/project 事实的“大权限中心”。
```
