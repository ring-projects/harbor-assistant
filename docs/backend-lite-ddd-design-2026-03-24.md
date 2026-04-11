# Backend Lite DDD Design

## 1. 文档信息

- 文档名称：Backend Lite DDD Design
- 日期：2026-03-24
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/project`
  - `apps/service/src/modules/tasks`
  - future `apps/service/src/modules/runtime`
  - future runtime policy resolution capability in application layer
  - supporting modules in `apps/service/src/modules/*`
- 关联文档：
  - [product-prd-2026-04-10.md](./product-prd-2026-04-10.md)
  - [project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
  - [orchestration-requirements-2026-03-31.md](./orchestration-requirements-2026-03-31.md)
  - [interaction-context-design-2026-03-24.md](./interaction-context-design-2026-03-24.md)
  - [task-event-storage-model.md](./task-event-storage-model.md)
  - [task-api.md](./task-api.md)
  - [project-api.md](./project-api.md)
  - [service-module-standard-based-on-project.md](./service-module-standard-based-on-project.md)
  - [service-error-handling-guide.md](./service-error-handling-guide.md)

## 2. 文档目标

这份文档不是再定义一套新的产品模型，而是作为这次后端优化的总指导文档，回答四个问题：

1. Harbor 后端为什么适合采用 `lite DDD`
2. `project / task / runtime` 三个核心上下文各自拥有什么，以及运行策略决议能力应放在哪里
3. 模块之间允许怎样依赖，不允许怎样依赖
4. 当前代码应该按什么顺序迁移，而不是一次性重写

这份文档是后端结构调整的指导文档，优先级高于局部目录重构偏好。

## 3. 为什么采用 Lite DDD

Harbor 当前后端已经不再是简单 CRUD 服务，至少出现了以下几类稳定业务概念：

1. `Project`
2. `ProjectSettings`
3. `Task`
4. `AgentSession`
5. task-oriented event query
6. raw runtime event storage and projection

当前主要问题也已经不是“缺少一个 service 文件”，而是边界混杂：

1. `tasks` 模块同时承担 task business、runtime integration、event ingestion、projection、realtime push
2. route / service / repository 的分层虽然已经有雏形，但业务真相与技术细节还没有真正分开
3. provider 差异容易直接泄漏到 task 语义中

因此，采用 `lite DDD` 的目的不是“追求 DDD 形式”，而是：

1. 重新收敛业务边界
2. 明确 aggregate 与 source of truth
3. 让 command 和 query 能独立演进
4. 隔离 provider protocol 对核心模型的污染

## 4. Lite DDD 的范围

这次只采用必要的 DDD 元素。

### 4.1 要保留的东西

1. bounded context
2. aggregate root
3. entity / domain object
4. application service / command handler / query service
5. repository 作为 aggregate persistence boundary
6. anti-corruption layer / provider adapter boundary

### 4.2 不要做的东西

1. 不做 event sourcing
2. 不做满天飞的 domain events
3. 不做过度 class 化
4. 不为每个字段强行创建 value object
5. 不为了“纯 DDD”牺牲现有 API 和迁移可行性

一句话总结：

本次优化的目标是“更清晰的边界和模型”，不是“更重的术语体系”。

## 5. 顶层上下文划分

推荐将后端拆成三个主上下文、三个 supporting context，以及一个应用层运行策略能力。

### 5.1 Core contexts

1. `project`
2. `task`
3. `runtime`

### 5.2 Supporting contexts

1. `interaction`
2. `filesystem`
3. `git`

### 5.3 Application capability

1. `runtime-policy`

未来如果需要，还可以新增：

1. `memory`
2. `skills`
3. `audit`

但第一阶段不建议继续扩大上下文数量。

补充判断：

1. `filesystem` 和 `git` 应单独划分
2. 但它们属于 supporting context，不属于 core domain
3. 第一阶段不建议把两者直接合并成一个重型 `workspace` domain

## 6. 各上下文职责

### 6.1 `project`

`project` 是业务上下文根。

project 聚合边界、settings owned record 设计、以及 project-scoped integration 的拆分原则，详见
[project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)。

它拥有：

1. `Project`
2. `ProjectSettings`
3. project identity
4. workspace root / normalized path
5. project-local skill bridge
6. project-scoped policy inputs

它不拥有：

1. task lifecycle
2. runtime session lifecycle
3. raw runtime events

### 6.2 `task`

`task` 是用户可见的工作单元上下文。

task 聚合边界、orchestration/task 拆分原则，以及 task-facing read model 设计，详见
[orchestration-requirements-2026-03-31.md](./orchestration-requirements-2026-03-31.md)。

它拥有：

1. `Task`
2. task lifecycle
3. create / archive / delete / update title
4. task detail / list / admin view
5. task-oriented event query
6. task-side read model

它不拥有：

1. provider protocol semantics
2. raw event persistence
3. runtime adapter implementation
4. channel-specific delivery contract

### 6.3 `runtime`

`runtime` 是平台执行上下文。

它拥有：

1. `AgentSession`
2. provider adapter
3. start / resume / cancel / recover
4. raw event ingestion
5. raw event persistence
6. capability query
7. runtime-oriented internal query

它不拥有：

1. task business structure
2. task business permissions
3. project business rule
4. front-end normalized event view

### 6.4 `runtime-policy`

`runtime-policy` 不是独立 bounded context，而是应用层能力。

它负责：

1. system config 读取
2. feature flag 读取
3. default policy inputs 合并
4. runtime policy resolution
5. `ResolvedRuntimeConfig` 生成

它不负责：

1. `ProjectSettings` 的主存储
2. task persistence
3. runtime execution
4. 独立业务实体生命周期

### 6.5 `interaction`

`interaction` 是交互渠道上下文，用于把核心领域变化投递给用户交互端。

interaction 的详细边界设计，见
[interaction-context-design-2026-03-24.md](./interaction-context-design-2026-03-24.md)。

它拥有：

1. websocket delivery
2. future slack / telegram channel adapter
3. interaction session / subscription
4. task / project topic delivery
5. interaction-side delivery projection
6. inbound user interaction normalization

它不拥有：

1. `Task` 的业务真相
2. `Project` 的业务真相
3. runtime raw event source of truth
4. provider execution lifecycle
5. task-side read model source of truth

### 6.6 `filesystem`

`filesystem` 是文件系统能力上下文，负责提供稳定的路径与文件访问边界。

它拥有：

1. path canonicalization
2. root boundary enforcement
3. file / directory listing
4. file read / write / stat
5. symlink / hidden file / missing path policy

它不拥有：

1. `Project` 的业务状态
2. `Task` 的业务状态
3. git repository 语义
4. runtime session lifecycle

### 6.7 `git`

`git` 是仓库状态与差异能力上下文。

它拥有：

1. repo root detection
2. git status / diff / history query
3. branch / HEAD / commit resolution
4. project git watcher
5. repo-scoped snapshot or query object

它不拥有：

1. `Project` 的业务状态
2. `Task` 的业务状态
3. runtime session lifecycle
4. 文件系统 root policy 的 source of truth

## 7. Aggregate 与核心模型

### 7.1 `project` context

更完整的 `Project` / `ProjectSettings` 聚合设计、invariants、repository boundary 与演进顺序，详见
[project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)。

aggregate root：

1. `Project`

entities / owned records：

1. `ProjectSettings`

设计原则：

1. `Project` 是 project context 的唯一业务入口
2. settings 可以作为 owned record 与 `Project` 协作
3. project path、status、settings 更新必须经由 project application layer 完成

### 7.2 `task` context

aggregate root：

1. `Task`

第一版 `Task` 负责表达：

1. 任务身份
2. task business state
3. 与 runtime session 的关联
4. 用户可见字段与 task-level metadata

设计原则：

1. `Task` 是 task business 的 source of truth
2. task 级动作以 `Task` 为中心建模
3. task query projection 可以是独立 read model，但不能反向决定 task aggregate

### 7.3 `runtime` context

aggregate root：

1. `AgentSession`

`AgentSession` 是长期、可恢复的 runtime context，不是一次性执行 attempt。

它负责表达：

1. provider session identity
2. runtime lifecycle state
3. 当前 session 的执行上下文
4. raw event history ownership

owned records：

1. `AgentEventRecord`
2. future `ResolvedRuntimeConfigSnapshot`
3. future lifecycle boundary records if needed

设计原则：

1. `AgentSession` 是 runtime context 的 source of truth
2. raw event 只属于 runtime context
3. task 不直接拥有 provider protocol state

### 7.4 `runtime-policy` capability

这里不建议引入独立 aggregate，更不建议先上升为第四个 core context。

第一版更适合使用：

1. `ResolvedRuntimeConfig` 作为决议结果对象
2. `RuntimePolicyResolver` 作为应用服务

重点不是实体多漂亮，而是明确“谁负责合并设置和生成快照”。

### 7.5 `interaction` context

`interaction` 不需要第一版就做成重型聚合，但建议至少明确以下概念：

1. `InteractionSession`
2. `Subscription`
3. `InteractionMessage`

推荐职责：

1. `InteractionSession`
   - 表示一个交互连接或外部会话端点
   - 例如 websocket connection、slack channel binding、telegram chat binding
2. `Subscription`
   - 表示对 `task` 或 `project` topic 的订阅关系
3. `InteractionMessage`
   - 表示面向渠道投递的 channel-neutral outbound message contract

设计原则：

1. `interaction` 消费 task/project 的变化，不反向拥有其状态
2. websocket / slack / telegram 都是 channel adapter，不是业务 aggregate
3. 第一版先支持 websocket，后续渠道沿同一边界扩展

### 7.6 `filesystem` context

`filesystem` 第一阶段不建议引入重型 aggregate。

更适合的模型是：

1. `PathPolicy`
2. `FileNode`
3. `DirectoryEntry`
4. `FilesystemService`
5. `FilesystemRepository`

设计原则：

1. `filesystem` 负责路径与访问规则
2. `project` 只拥有 project root path，不自己实现文件系统规则
3. `runtime` 只消费 working directory / path 校验结果，不重写同样逻辑

### 7.7 `git` context

`git` 第一阶段也不建议引入重型 aggregate。

更适合的模型是：

1. `GitRepositoryRef`
2. `GitStatusSnapshot`
3. `GitDiff`
4. `GitService`
5. `ProjectGitWatcher`

设计原则：

1. `git` 负责 repo 状态和差异语义
2. `task` 可以消费 diff / status / watcher 结果，但不拥有 git 语义
3. `project` 可以关联 repo 信息，但不自己实现 git 规则

## 8. 模型归属规则

这是这次重构最重要的一组规则。

### 8.1 canonical owners

1. `Project` / `ProjectSettings` 归 `project`
2. `Task` 归 `task`
3. `AgentSession` / `AgentEventRecord` 归 `runtime`
4. `ResolvedRuntimeConfig` 归 `runtime-policy` capability 的结果对象
5. `InteractionSession` / `Subscription` / outbound delivery contract 归 `interaction`
6. path / listing / stat rule 归 `filesystem`
7. repo status / diff / watcher rule 归 `git`

### 8.2 pointer 与 source of truth

允许存在快捷 pointer，但必须明确谁是 canonical owner。

例如：

1. `Task.agentSessionId` 可以存在
2. 但它只是 task 到 runtime 的 canonical relation pointer
3. raw event 不允许再在 task 侧落一份同义 source of truth

### 8.3 query projection 不反向定义 domain model

1. `/tasks/:taskId/events` 的 normalized stream 是 query projection
2. chat block、timeline block、UI event 都是 read model
3. 它们不能反向定义 `Task` 或 `AgentSession` 的存储形态

### 8.4 interaction delivery 不反向定义 core model

1. websocket message
2. slack message
3. telegram message

这些都只是 interaction-side delivery contract。

它们不能反向决定：

1. `Task` 如何建模
2. `Project` 如何建模
3. `AgentSession` 如何建模

### 8.5 task read model 与 interaction delivery model 分离

必须明确区分两类模型：

1. task read model
   - 由 `task` context 负责
   - 例如 task detail、task list item、task event normalized stream
2. interaction delivery model
   - 由 `interaction` context 负责
   - 例如 websocket payload、slack message、telegram message

规则：

1. `task` 决定 task 视角下的业务信息
2. `interaction` 决定这些信息如何按渠道投递
3. websocket payload 不应反向变成 `task` domain 的 source of truth

## 9. Command / Query 分离

本次后端优化建议明确采用轻量 CQRS 风格。

不是为了引入新的基础设施，而是为了防止一个 `service.ts` 文件同时做五件事。

### 9.1 `task` commands

建议至少拆成这些应用动作：

1. `CreateTask`
2. `CancelTask`
3. `ArchiveTask`
4. `DeleteTask`
5. `UpdateTaskTitle`

### 9.2 `task` queries

建议至少拆成这些查询动作：

1. `GetTaskDetail`
2. `ListProjectTasks`
3. `GetTaskEvents`
4. `GetTaskRealtimeView`

### 9.3 `project` commands / queries

这些 command / query 在 `project` context 中的更细粒度拆分建议，详见
[project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)。

commands：

1. `CreateProject`
2. `UpdateProject`
3. `ArchiveProject`
4. `UpdateProjectSettings`

queries：

1. `ListProjects`
2. `GetProjectDetail`
3. `GetProjectSettings`

### 9.4 `runtime` commands / queries

commands：

1. `StartSession`
2. `ResumeSession`
3. `CancelSession`
4. `AppendRawEvent`
5. `RecoverSession`

queries：

1. `GetSession`
2. `ListSessionRawEvents`
3. `InspectRuntimeCapabilities`

### 9.5 `interaction` commands / queries

commands：

1. `OpenInteractionSession`
2. `CloseInteractionSession`
3. `SubscribeTaskTopic`
4. `SubscribeProjectTopic`
5. `PublishInteractionMessage`
6. `DispatchChannelMessage`
7. `NormalizeInboundInteraction`

queries：

1. `GetInteractionSession`
2. `ListSubscriptions`
3. `ListPendingDeliveries` if persistence is added later

### 9.6 `filesystem` commands / queries

以下列表表示可能需要的能力边界，不表示第一阶段必须全部建成的公开 surface。

commands：

1. optional `WriteFile`
2. optional `CreateDirectory`
3. optional `DeletePath` if product later allows it

queries：

1. `ListDirectory`
2. `ReadFile`
3. `StatPath`
4. `ResolveWithinRoot`

### 9.7 `git` commands / queries

以下列表表示可能需要的能力边界，不表示第一阶段必须全部建成的公开 surface。

commands：

1. optional `RefreshRepositoryState`
2. optional `StartProjectGitWatcher`
3. optional `StopProjectGitWatcher`

queries：

1. `GetRepositoryRoot`
2. `GetGitStatus`
3. `GetGitDiff`
4. `ListBranches`

## 10. 分层规则

推荐分层如下：

```text
interfaces -> application -> domain
                    |
              infrastructure
```

### 10.1 `interfaces`

负责：

1. HTTP route
2. websocket / realtime endpoint
3. internal module API facade
4. inbound channel webhook / callback endpoint

不负责：

1. 业务决策
2. 持久化细节
3. provider protocol handling

### 10.2 `application`

负责：

1. use case orchestration
2. command / query handler
3. transaction boundary
4. aggregate coordination
5. error mapping to domain/application errors

不负责：

1. HTTP transport shape
2. provider raw protocol parsing
3. direct UI projection formatting

### 10.3 `domain`

负责：

1. aggregate invariant
2. domain rules
3. state transition helpers
4. business terminology

不负责：

1. Prisma
2. Fastify
3. external SDK
4. route schema

### 10.4 `infrastructure`

负责：

1. repository implementation
2. Prisma mapping
3. provider adapter
4. event streaming transport
5. filesystem / git / external process integration
6. websocket / slack / telegram channel transport

不负责：

1. 定义业务真相
2. 决定 task business rule

## 11. 依赖方向

必须遵守的依赖规则：

1. `project` 不能依赖 `task`
2. `runtime` 不能依赖 `task`
3. `runtime` 不能依赖 `project` 业务规则，只能消费 project 输入与 runtime-policy 决议结果
4. `task` 可以依赖 `runtime` application boundary
5. `task` 可以依赖 `project` application/query boundary，但不应直接依赖 `project` repository`
6. `runtime-policy` capability 可以被 `task` 和 `runtime` 共同使用
7. `interaction` 可以依赖 `task` 和 `project` 的 query / notification boundary
8. `task`、`project`、`runtime` 不反向依赖 `interaction`
9. `project`、`task`、`runtime` 可以依赖 `filesystem` 的 query / policy boundary
10. `project`、`task` 可以依赖 `git` 的 query boundary
11. `git` 可以依赖 `filesystem` 或更底层 path capability，但不反向定义 `filesystem` 的规则
12. `filesystem`、`git` 作为 supporting context，不反向依赖 core business context

一句话：

`task` 可以编排 `runtime`，但 `runtime` 不能反向理解 `task`。

补充一句：

`interaction` 可以投递 task/project 的变化，但 task/project 不能为了某个渠道反向污染自己的模型。

再补一条：

跨上下文访问 aggregate 时，优先走 application service、query service 或明确的 internal facade，不跨 context 直接使用 repository。

## 12. 推荐目录形态

这不是一次性必须落地的最终目录，而是目标结构。

```text
apps/service/src/modules/
  project/
    domain/
    application/
      commands/
      queries/
    infrastructure/
      persistence/
    interfaces/
      http/

  tasks/
    domain/
    application/
      commands/
      queries/
    infrastructure/
      persistence/
      projections/
    interfaces/
      http/

  runtime/
    domain/
    application/
      commands/
      queries/
    infrastructure/
      persistence/
      providers/
      streaming/
    interfaces/
      internal/

  runtime-policy/
    application/
    infrastructure/

  interaction/
    domain/
    application/
      commands/
      queries/
    infrastructure/
      channels/
        websocket/
        slack/
        telegram/
      delivery/
      projections/
    interfaces/
      websocket/
      webhooks/
      internal/

  filesystem/
    domain/
    application/
      commands/
      queries/
    infrastructure/
      persistence/
    interfaces/
      http/

  git/
    domain/
    application/
      commands/
      queries/
    infrastructure/
      persistence/
      watchers/
    interfaces/
      http/
```

说明：

1. 当前 `tasks` 目录可以继续保留复数形式，避免一次性重命名带来噪音
2. websocket 逻辑长期应从 `tasks/realtime/*` 迁到 `interaction`
3. `filesystem` 和 `git` 继续保持独立，而不是现在就合成一个 `workspace` domain
4. 重点是边界和依赖，而不是文件夹名是否绝对优雅

## 13. API 设计原则

HTTP API 不需要立刻全面重写，但需要逐步对齐领域动作。

### 13.1 task-facing API

可以继续保留：

1. `POST /tasks`
2. `POST /tasks/:taskId/cancel`
3. `GET /tasks/:taskId/events`

这些接口是 task context 的应用入口，而不是 runtime context 的直接暴露。

### 13.2 runtime API

第一版不建议对前端公开通用 `/sessions/...` API。

原因：

1. session 是内部 runtime aggregate
2. 产品当前仍以 task 为主视图
3. runtime query 先作为 internal service 存在更稳

### 13.3 project API

`project` 对外 API 的稳定归属、settings API 的定位、以及 overview query 的建议，详见
[project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)。

继续由 project context 对外负责：

1. project CRUD
2. project settings
3. project-scoped supporting capability

### 13.4 interaction API

第一版不建议立即设计完整的 public interaction API，但应预留边界：

1. websocket subscribe / unsubscribe
2. future slack webhook / slash command / bot callback
3. future telegram webhook / bot callback

原则：

1. 它们属于 `interaction` context
2. 它们调用 task/project application boundary
3. 它们不直接越过业务上下文操作 repository

### 13.5 filesystem / git API

这两类 API 可以继续对前端暴露，但语义上属于 supporting contexts：

1. filesystem API 负责目录与文件浏览
2. git API 负责 repo 状态与 diff 查询

约束：

1. 不要把它们重新塞回 `project` API
2. 不要让 task/project route 直接复制 filesystem/git 逻辑

## 14. Provider Adapter 规则

provider integration 必须被视为 anti-corruption layer。

### 14.1 adapter 的职责

1. 接入 codex / claude-code / future runtime
2. 解析 provider protocol
3. 输出 runtime 内部可接受的 raw envelope
4. 暴露 capability probe

### 14.2 adapter 不应做的事

1. 不直接更新 `Task`
2. 不直接决定 task status
3. 不直接生成 UI-facing event
4. 不直接读取 project business state

### 14.3 raw event 边界

继续遵守 [task-event-storage-model.md](./task-event-storage-model.md)：

1. raw event 是 source of truth
2. projection 发生在 query 时
3. runtime 存 raw，task 存 read model

## 15. Interaction / Delivery 规则

`interaction` context 需要解决的是“如何把核心领域变化送到用户所在渠道”，而不是“重新定义业务真相”。

### 15.1 topic owner

第一版建议只支持两类 topic：

1. `project:{projectId}`
2. `task:{taskId}`

owner 规则：

1. `project` 是 project topic 的 owner
2. `task` 是 task topic 的 owner
3. `interaction` 只负责订阅、投递、渠道适配

### 15.1.1 最小 notification mechanism

本次优化不引入重型 domain event 体系，但必须有一个最小通知边界。

第一版建议采用：

1. application-level notification
2. internal publisher/subscriber boundary
3. 第一版优先使用进程内原生事件机制，例如 `EventEmitter`

目标不是引入复杂基础设施，而是明确：

1. `task` / `project` 可以发布状态变化通知
2. `interaction` 订阅这些通知并做 delivery
3. 这个边界不等于 repository callback，也不等于让 channel adapter 直接调用业务 service 获取一切状态

补充约束：

1. core module 的 notification boundary 不应直接暴露 websocket contract
2. core module 的 notification boundary 不应直接绑定 `rxjs`
3. 如果 `interaction` 需要 stream 语义，可以在 adapter 层自行包装

第一版允许的通知类型可先收敛为：

1. `TaskStatusChanged`
2. `TaskEventProjected`
3. `ProjectUpdated`

### 15.2 outbound delivery contract

建议在 `interaction` 内部定义 channel-neutral contract，例如：

```ts
InteractionMessage {
  topicType: "project" | "task"
  topicId: string
  kind:
    | "project-updated"
    | "task-status-changed"
    | "task-event"
    | "action-required"
  summary: string
  body?: unknown
  actions?: InteractionAction[]
}
```

用途：

1. websocket 可以直接发送较细粒度 payload
2. slack / telegram 可以基于同一 contract 做渠道投影

### 15.3 inbound normalization

以后 slack / telegram 接入后，用户操作不应直接变成“调用 repository 的脚本式逻辑”。

正确方向是：

1. 渠道输入先进入 `interaction`
2. `interaction` 将其归一化为内部 action
3. 再调用 `task` 或 `project` 的 application command

### 15.4 不要把 socket 留在 task/project 中长期生长

短期可以先兼容现有 `tasks/realtime/*`，但长期应迁出。

否则会出现：

1. task websocket 逻辑放在 `tasks`
2. project websocket 逻辑放在 `project`
3. slack/telegram 再复制一套逻辑

这会让交互渠道边界持续发散。

### 15.5 websocket 的定位

websocket 不是 `task` context 的 domain boundary，而是 `interaction` 的 channel adapter。

因此：

1. task 可以提供 task-side read model
2. interaction 负责将其编码为 websocket payload
3. websocket 连接、订阅、游标和推送可靠性都属于 interaction 关注点

## 16. Filesystem / Git 规则

这两个上下文需要单独划分，但不需要在第一阶段升格成 core domain。

### 16.1 为什么要单独划分

`filesystem` 有独立规则：

1. path canonicalization
2. root boundary
3. hidden / symlink / missing path policy

`git` 有独立规则：

1. repo root detection
2. diff / status / branch / commit semantics
3. watcher lifecycle

把它们直接塞进 `project` 或 `task` 会污染业务边界。

### 16.2 为什么不是 core domain

因为 Harbor 当前的核心业务真相仍然是：

1. `Project`
2. `Task`
3. `AgentSession`
4. runtime policy resolution result snapshot

而 `filesystem` / `git` 更多是在支撑：

1. workspace access
2. diff / repo query
3. task context enrichment

所以它们更适合 supporting context / generic subdomain。

### 16.3 是否需要 `workspace` domain

第一阶段建议：

1. 不要现在就把 `filesystem` 和 `git` 合并成一个重型 `workspace` domain
2. 如果未来经常需要组合查询，可新增轻量 `workspace facade`
3. 这个 facade 更适合放在 application/read-model 层，而不是先定义成新的大 aggregate

## 17. 运行策略与快照

这部分是当前架构最容易模糊的地方，必须明确。

### 17.1 配置来源

1. env / system config
2. feature flags
3. `ProjectSettings`
4. task request overrides

### 17.2 决议结果

应用层 `runtime-policy` capability 应输出：

```ts
ResolvedRuntimeConfig
```

至少包含：

1. `agentType`
2. `model`
3. `executionMode`
4. `approvalPolicy`
5. `sandboxPolicy`
6. `workingDirectory`
7. `webSearchPolicy`

### 17.3 快照原则

为了避免 create / cancel / recover 等执行编排动作发生行为漂移，必须允许把决议结果快照化。

第一版建议：

1. `ResolvedRuntimeConfig` 至少应能落到 `AgentSession`
2. 如果未来 session 内需要区分多次继续执行，再考虑更细粒度快照

## 18. 错误模型

继续采用当前已验证有效的统一错误模式：

1. 模块自己的错误类型
2. 模块自己的错误工厂
3. 全局 `AppError` 收口

详见 [service-error-handling-guide.md](./service-error-handling-guide.md)。

Lite DDD 不要求每层都定义新错误类，要求的是：

1. 错误责任归属清楚
2. 错误码稳定
3. route 不做局部错误映射表

## 19. 与当前代码的对应关系

### 19.1 当前已有基础

当前代码已经具备一部分可复用基础：

1. `project` 模块结构已经较接近目标形态
2. `tasks` 已经有 route / service / repository / projector 分层雏形
3. raw event storage and projection 原则已基本建立
4. 全局错误处理与模块错误体系已存在

### 19.2 当前主要缺口

1. `tasks` 还没有真正分离 command / query
2. runtime provider integration 仍然混在 `tasks` 或 `lib/agents`
3. runtime policy resolution 还没有形成明确应用层边界
4. domain rules 仍然大量沉在 service / repository 里

## 20. 分阶段迁移方案

### Phase 1: 固定模型与术语

目标：

1. 确认 `project / task / runtime` 三个核心上下文
2. 确认 `runtime-policy` 只是应用层能力，不单列为 core context
3. 确认 `Task` 和 `AgentSession` 两个核心 aggregate
4. 停止继续在旧大服务里增加新职责

产出：

1. 当前这份指导文档
2. task/runtime 主设计文档

### Phase 2: 在现有模块内先做逻辑分层

目标：

1. 不急着移动太多文件
2. 先把 `tasks/services/*` 拆成 command / query 方向
3. 把 provider integration 从 task business orchestration 中抽出来
4. 停止继续跨 context 直接依赖 repository

产出：

1. `tasks/application/commands/*`
2. `tasks/application/queries/*`
3. runtime application facade

### Phase 2.5: 抽出 interaction 边界

目标：

1. 先定义 `interaction` supporting context
2. 把 websocket topic / subscription / delivery 概念从 task/project 中抽出来
3. 保持现有 websocket 行为不变，但边界转正
4. 落最小 notification mechanism，而不是让 websocket 直接绑业务 service

产出：

1. `interaction` module skeleton
2. websocket delivery facade
3. task/project notification -> interaction publish boundary

### Phase 2.6: 收敛 supporting contexts

目标：

1. 保持 `filesystem` 和 `git` 的边界独立
2. 把共享规则从 project/task 中抽离
3. 避免后续继续在 core context 内复制 supporting logic

产出：

1. `filesystem` query / policy boundary
2. `git` query / watcher boundary
3. 明确 future `workspace facade` 只作为组合层存在

### Phase 3: 抽出 `runtime` context

目标：

1. 新建 `modules/runtime`
2. 迁出 raw event repository / stream / provider adapter
3. 建立 `AgentSession` persistence boundary

产出：

1. runtime repositories
2. runtime provider adapters
3. internal runtime services

### Phase 4: 收敛 `runtime-policy` capability

目标：

1. 把 settings merge / runtime policy resolution 从 task service 中抽出来
2. 建立 `ResolvedRuntimeConfig` 生成逻辑
3. 明确 snapshot 落点

### Phase 5: 再做聚合和 read model 细化

目标：

1. 细化 `Task` / `AgentSession` 不变量
2. 细化 synthetic boundary events
3. 逐步收缩旧字段和旧 service
4. 逐步扩展 `interaction` 到 slack / telegram

## 21. 非目标

这次后端优化不做：

1. 不做 full DDD 教科书式重构
2. 不做 event sourcing
3. 不做一次性全面改 API
4. 不做为了目录美观而大规模 rename
5. 不做脱离现有代码现实的“从零重写”

## 22. 最终结论

Harbor 当前后端适合采用 `lite DDD`，但必须保持克制。

本次优化的核心不是“把所有代码包装成 DDD 术语”，而是：

1. 用 bounded context 收敛责任
2. 用 aggregate 明确业务真相
3. 用 command / query 分离减少 service 膨胀
4. 用 runtime adapter 隔离 provider 协议污染
5. 用 interaction context 隔离 websocket 和未来外部渠道
6. 把 filesystem / git 固定为独立 supporting contexts
7. 在不破坏现有 API 的前提下逐步迁移

第一阶段的核心判断可以收敛成几句：

```text
Project owns project identity and settings.
Task owns user-visible work units and task orchestration.
Runtime owns AgentSession and raw runtime events.
Runtime-policy resolves execution policy and produces resolved runtime config snapshots.
Interaction owns channel delivery and inbound interaction normalization.
Filesystem owns path and file access rules.
Git owns repository state and diff/query semantics.
```

如果后续重构仍然能保持这些判断成立，那么这次 lite DDD 优化就是朝正确方向在推进。
