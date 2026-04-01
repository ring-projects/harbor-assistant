# Task Context Design

> [!WARNING]
> **状态：已过时（Outdated）**
> 当前系统主模型已调整为 `Orchestration -> N Tasks`。
> 这些文档仍可作为历史背景参考，但不应再作为最新设计依据。
> 请优先参考：`docs/orchestration-requirements-2026-03-31.md` 与 `docs/tdd/orchestration.md`。


## 1. 文档信息

- 文档名称：Task Context Design
- 日期：2026-03-25
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/task`
  - 已移除的早期 task 实现，仅作为迁移背景
  - future task command / query / facade / route design
- 关联文档：
  - [backend-lite-ddd-design-2026-03-24.md](./backend-lite-ddd-design-2026-03-24.md)
  - [task-runtime-system-design-2026-03-23.md](./task-runtime-system-design-2026-03-23.md)
  - [interaction-context-design-2026-03-24.md](./interaction-context-design-2026-03-24.md)
  - [project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
  - [service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
  - [task-event-storage-model.md](./task-event-storage-model.md)
  - [task-api.md](./task-api.md)

## 2. 文档目标

这份文档只解决 `task` context 的设计，不试图一次性重写 `runtime` 或 `interaction`。

它要回答的问题只有六个：

1. 新的 `task` context 到底拥有谁
2. `task` 和 `runtime / interaction / project` 之间应该如何分边界
3. 早期 task 实现里哪些责任必须被拆出
4. 新的 `task` 应向外暴露哪些 command / query / notification boundary
5. `task` 内部的聚合、read model、错误模型该怎样收敛
6. 从当前实现迁移到新设计时，应该按什么顺序推进

这里默认一个前提：

已移除的早期 task 实现只能作为现状样本，不作为目标设计依据。目标设计以主文档中的 bounded context、source of truth 和 dependency direction 为准。

## 3. 设计前提

根据主文档与 task/runtime 设计文档，本设计采用以下判断作为前提：

1. `task` 是 core business context，不是 provider runtime wrapper
2. `Task` 是用户可见工作单元，是 `task` context 的 aggregate root
3. `task` 拥有 task lifecycle 与 task-facing read model
4. `task` 不拥有 raw runtime event source of truth
5. `task` 可以编排 `runtime`，但不能把 provider protocol 泄漏成自己的领域模型
6. `interaction` 可以消费 `task` 的 query / notification boundary，但 `task` 不反向理解 websocket contract
7. `project` 提供 project identity 与 project-level defaults，`task` 不能反向拥有 `Project`

一句话收敛：

```text
Task owns business-visible work units and task-facing read models.
Runtime owns execution sessions and raw runtime events.
Interaction only delivers task changes to clients.
```

## 4. 当前问题

早期 task 实现最大的问题不是功能少，而是责任堆叠得太厚。

### 4.1 同一个模块同时承担四层责任

早期 task 实现里同时包含：

1. task business command / query
2. runtime integration
3. raw event ingestion / projection
4. interaction delivery 接线

这导致一个模块既像业务上下文，又像平台执行层，又像交互边界。

### 4.2 `task` 与 `runtime` 责任混杂

当前实现中，下面这些内容长期混在 `tasks` 里：

1. task create / archive / delete 等业务动作
2. runtime policy resolution
3. agent runner / provider adapter 编排
4. runner recovery
5. raw event ingestion

其中真正属于 `task` 的只有：

1. task lifecycle
2. 独立 task 的业务状态
3. task-facing read model
4. task-oriented command / query

### 4.3 `task` 与 `interaction` 虽已开始拆分，但 notification boundary 还不够显式

当前我们已经把 websocket owner 挪到了 `interaction`，这是对的。

但 `task` 还需要继续往前收敛：

1. task 应输出 notification / stream boundary
2. interaction 应消费这个 boundary
3. task 不应继续理解任何 channel-specific contract

### 4.4 `task` read model 与 runtime raw model 仍然容易混淆

当前 `/tasks/:taskId/events` 返回的是 task-facing normalized event stream，而不是 raw runtime record。

这是正确方向，但文档与模块边界还需要进一步固定：

1. task event query 是 read model
2. raw runtime event 不属于 task source of truth
3. task event query 可以依赖 runtime raw event projection，但不拥有 raw storage

## 5. `task` context 的职责边界

### 5.1 它负责什么

新的 `task` context 负责以下业务真相：

1. `Task`
2. task lifecycle
3. create / archive / delete / update title
4. task detail / list / admin view
5. task-facing event query
6. task-side status projection

这里最关键的点不是“task 能运行一个 agent”，而是：

task 提供的是用户可理解的工作单元语义，而不是 provider session 语义。

### 5.2 它不负责什么

新的 `task` context 不负责：

1. provider adapter implementation
2. raw runtime event source of truth
3. websocket contract
4. git / filesystem policy
5. project settings 主存储
6. runtime policy resolution capability 本体

尤其要避免三种退化：

1. 把 `task` 做成一切执行能力的总调度大类库
2. 让 provider protocol 直接变成 `task` 领域字段
3. 让 interaction contract 反向定义 task read model

## 6. 聚合设计

### 6.1 Aggregate Root

`Task` 是 `task` context 的 aggregate root。

第一版建议的领域表达：

```ts
Task {
  id: string
  projectId: string
  title: string
  prompt: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
}
```

说明：

1. `Task` 必须保持对用户可见
2. `Task` 不应直接包含 provider-specific session 字段
3. 如果 `Task` 需要关联 `runtime`，推荐通过 canonical relation pointer，而不是把 runtime 状态揉进 task 模型

### 6.2 与 runtime execution 的关系

task 需要和执行上下文有关联，但不意味着它拥有执行上下文。

当前更推荐的表达不是在 `Task` 聚合里内嵌 `TaskExecutionPointer`，而是：

1. `Task` 只保留 task 语义字段
2. `Execution` 作为独立持久化模型表达一次执行尝试
3. `ExecutionEvent` 归属于一次 execution，而不是直接归属于 task

这意味着：

1. 当前 `task` 应知道自己关联一个持续的 canonical execution
2. 但 execution lifecycle 仍归 `runtime execution` 边界
3. `task` 不应因为知道 session/thread 关系，就把 provider session 状态吸进自己的聚合

当前实现约束补充：

1. `resume` 是在同一个 `Execution` 上继续运行
2. 不为 `resume` 新建第二个 execution 记录
3. 是否未来需要一个 task 对应多个独立 execution，应等产品语义明确后再放开

### 6.3 关系语义刻意留空

第一版不在 `Task` 聚合中引入：

1. `parentTaskId`
2. `triggeredByTaskId`
3. `orchestrationRunId`

原因不是这些关系永远不需要，而是：

1. `task` 当前只建模独立任务单元
2. 多 agent 编排将来应由独立的 orchestration 模型表达
3. 没有被产品明确证明的子任务/lineage 语义，不应提前固化进 `Task`

因此当前判断是：

```text
Task does not own hierarchy, lineage, or orchestration relations.
```

## 7. 核心不变量

`Task` 至少应维护这些稳定不变量：

1. task 必须属于一个存在的 `Project`
2. archived task 不能再次归档
3. archived task 不能被任意 route 直接改写为活动态
4. task title 可以被更新，但不应破坏 task identity
5. task-facing status 只能来自受控投影，不允许被任意 route 直接改写

最后一点非常重要：

task status 是业务投影，不是 provider runtime 原始状态字符串。

## 8. Read Model 设计

### 8.1 `task` 拥有 task-facing read model

新的 `task` context 应显式拥有以下 read models：

1. `TaskListItem`
2. `TaskDetail`
3. `TaskAdminView`
4. `TaskEventStream`

### 8.2 `TaskEventStream` 是 task 视角，不是 raw runtime 视角

推荐继续保留下面这个判断：

```text
Task event stream is a projected task-facing read model.
It is not the raw runtime event store.
```

这意味着：

1. `/tasks/:taskId/events` 返回 normalized task event
2. raw runtime event 的 query 应归 `runtime`
3. 如果 projection 规则变化，应改 task read model，而不是篡改 raw source of truth

### 8.3 不要让 interaction 反向定义 task read model

新的 task read model 不应以 websocket payload 形状为目标。

正确依赖方向是：

1. `task` 决定 read model
2. `interaction` 决定 delivery contract

## 9. Command / Query 设计

### 9.1 Commands

第一版建议明确这些 command use cases：

1. `CreateTask`
2. `ArchiveTask`
3. `DeleteTask`
4. `UpdateTaskTitle`
5. future `CancelTask`

关键原则：

1. 一个 use case 表达一个明确业务意图
2. 不要用一个大而全的 `patchTask`
3. runtime side effect 是 command 编排结果，不是 task aggregate 直接负责

### 9.2 Queries

第一版建议明确这些 queries：

1. `GetTaskDetail`
2. `ListProjectTasks`
3. `GetTaskEvents`

### 9.3 Notifications / Subscription Boundary

为了给 `interaction` 消费，新的 `task` 应显式提供：

1. `TaskNotificationPublisher`
2. `TaskNotificationSubscriber`
3. task-native notification model

这层应该被定义为 `task` 的 outward boundary，而不是 websocket gateway 的内部细节。

关键约束：

1. `task` 不直接暴露 websocket payload
2. `task` 不直接暴露 RxJS `Observable`
3. `interaction` 如果需要 stream 语义，应在适配层把 subscriber 包装成自己的 stream 模型

## 10. 与其他上下文的边界

### 10.1 `task` 与 `project`

`project` 负责：

1. project identity
2. root path
3. project-level defaults
4. project business state

`task` 负责：

1. task lifecycle
2. task relation to project
3. project-scoped task query

依赖方向：

```text
task -> project query / policy inputs
```

而不是：

```text
project -> task internals
```

### 10.2 `task` 与 `runtime`

`runtime` 负责：

1. `AgentSession`
2. start / resume / cancel / recover
3. raw event ingestion
4. raw event persistence

`task` 负责：

1. task business command
2. task-facing status projection
3. task-facing event query

关键原则：

1. task 可以编排 runtime
2. runtime 不能反向拥有 task 业务规则
3. runtime raw event 不应直接变成 task source of truth

### 10.3 `task` 与 `interaction`

`interaction` 负责 delivery，不负责业务真相。

所以：

1. task 输出 query / notification boundary
2. interaction 消费这些边界并编码成 channel contract
3. task 不理解 websocket event name

### 10.4 `task` 与 `runtime-policy`

`runtime-policy` 是应用层 capability，不是 task 子域。

task 在 command 编排中可以使用它，但不应把策略决议逻辑永久塞在 `task.service.ts` 里。

推荐方向：

```text
task command
  -> read project defaults
  -> call runtime-policy resolver
  -> call runtime application boundary
```

## 11. 外部依赖口设计

`task` 不应该直接依赖 `project service`、`runner service`、`socket gateway` 这类大对象。

新的 `task` module 应只依赖少数几个明确的 port / facade。

### 11.1 `ProjectTaskPort`

用途：

1. 验证 project 是否存在
2. 读取 task 创建所需的 project-level defaults
3. 读取 project root / workspace identity

它不负责：

1. 让 `task` 直接修改 `Project`
2. 把 project repository 暴露给 `task`
3. 承担 task input image 这类文件落盘职责

推荐方向：

```ts
type ProjectTaskPort = {
  getProjectForTask(projectId: string): Promise<{
    projectId: string
    rootPath: string
    settings: {
      defaultExecutor: string | null
      defaultModel: string | null
      defaultExecutionMode: string | null
      maxConcurrentTasks: number
    }
  } | null>
}
```

### 11.2 `TaskInputImageStore`

用途：

1. 把 task 输入图片保存到 project workspace
2. 返回可直接作为 `local_image.path` 的相对路径
3. 隔离文件命名、目录创建、写盘失败等基础设施细节

它不负责：

1. 验证 project 是否存在
2. 决定 media type 是否允许
3. 处理 route / request body 校验

推荐方向：

```ts
type TaskInputImageStore = {
  save(input: {
    projectPath: string
    name: string
    content: Buffer
  }): Promise<{
    path: string
    size: number
  }>
}
```

这样 `uploadTaskInputImageUseCase` 只负责应用规则编排，Node `fs` / `path` / `mkdir` / `writeFile`
全部留在 infrastructure implementation。

### 11.3 `TaskRuntimePort`

用途：

1. 为新 task 启动 runtime execution
2. 在同一个 execution 上恢复 terminal task
3. 请求 break / cancel / recover 这类执行编排动作
4. 查询 task 对应的 canonical runtime pointer

它不负责：

1. 把 raw runtime event 暴露成 task domain model
2. 让 `task` 理解 provider protocol

推荐方向：

```ts
type TaskRuntimePort = {
  startTaskExecution(input: {
    taskId: string
    projectId: string
    prompt: string
    runtimeConfig: {
      executor: string
      model: string | null
      executionMode: string | null
    }
  }): Promise<void>

  resumeTaskExecution(input: {
    taskId: string
    projectId: string
    projectPath: string
    prompt: string
  }): Promise<void>
}
```

### 11.3 `TaskEventProjectionPort`

用途：

1. 将 runtime raw event 读取为 task-facing projected stream
2. 保持 `/tasks/:taskId/events` 是 task query，而不是 runtime raw query

它不负责：

1. 持有 raw event source of truth
2. 让 route 直接拼装 raw event

### 11.4 `TaskNotificationPublisher` / `TaskNotificationSubscriber`

推荐先定义 task 自己的 notification model，例如：

```ts
type TaskNotification =
  | {
      type: "task_upserted"
      projectId: string
      task: TaskListItem
    }
  | {
      type: "task_deleted"
      projectId: string
      taskId: string
    }
  | {
      type: "task_event_appended"
      projectId: string
      taskId: string
      event: TaskEventItem
    }
```

其中：

1. notification payload 只表达 task 自己拥有的业务数据
2. 不包含 websocket event name
3. 不包含 room / subscription key
4. 不直接复用 `interaction` 的 contract type

用途：

1. 发布 task detail 变化
2. 发布 project-scoped task list 变化
3. 给 `interaction` 提供可消费的 notification boundary

它不负责：

1. websocket event name
2. room / subscription / cursor 语义

推荐接口：

```ts
type TaskNotificationPublisher = {
  publish(notification: TaskNotification): Promise<void> | void
}

type TaskNotificationSubscriber = {
  subscribe(args: {
    projectId?: string
    taskId?: string
    listener: (notification: TaskNotification) => void
  }): () => void
}
```

第一版基础设施建议：

1. 采用进程内 `EventEmitter` 实现
2. 不把 `rxjs` 作为 `task` outward boundary 的一部分
3. `interaction` 如需 `Observable`，在 facade / adapter 层二次封装
4. 等进入多实例或可靠投递阶段，再替换为 outbox / message bus 实现

### 11.5 `RuntimePolicyResolver`

这是应用层 capability，不应塞进 `task` domain。

`task` command 只依赖它的结果，不拥有决议算法本体。

推荐依赖方向：

```text
task command
  -> ProjectTaskPort
  -> RuntimePolicyResolver
  -> TaskRuntimePort
  -> TaskRepository
  -> TaskNotificationPublisher
```

## 12. 推荐模块结构

目标目录意图建议为：

```text
apps/service/src/modules/task/
  domain/
    task.ts
    task-status.ts
  application/
    commands/
      create-task.ts
      archive-task.ts
      delete-task.ts
      update-task-title.ts
    queries/
      get-task-detail.ts
      list-project-tasks.ts
      get-task-events.ts
    ports/
      task-repository.ts
      project-task-port.ts
      task-runtime-port.ts
      task-event-projection-port.ts
      task-notification-publisher.ts
      task-notification-subscriber.ts
  infrastructure/
    persistence/
    projection/
    notification/
  facade/
    current-task-facade.ts
  routes/
  schemas/
```

第一阶段不要求一次性全部做完，但目录意图必须先明确。

### 12.1 第一阶段最小落地范围

第一阶段不应该试图把全部 task 能力一口气重写完。

建议只先落下面这些最小稳定面：

1. `Task` aggregate 与核心不变量
2. `GetTaskDetail`
3. `ListProjectTasks`
4. `ArchiveTask`
5. `DeleteTask`
6. `UpdateTaskTitle`
7. `TaskNotificationPublisher` / `TaskNotificationSubscriber` 的最小能力

这几个能力的共同点是：

1. 用户价值明确
2. runtime 耦合较低
3. 最适合先把新的 command / query / repository / notification 形状固定下来

`CreateTask` 应放到第二阶段，再通过 facade 编排 runtime。

## 13. 当前实现如何拆

以已移除的早期 task 实现来看，建议按下面方式拆分责任。

### 13.1 保留在 `task`

1. task commands
2. task queries
3. task read model projection
4. task admin semantics
5. task-native notification model

### 13.2 迁出到 `runtime`

1. task agent runner
2. raw event ingestion service
3. runner recovery
4. provider adapter integration
5. session lifecycle management

### 13.3 保持在 `interaction`

1. websocket session / subscription
2. delivery contract
3. channel-specific adapter

### 13.4 迁到应用层 capability

1. runtime policy resolution
2. project defaults merge
3. request override merge

### 13.5 命名与迁移约束

当前仓库里还有一个过渡入口：

- `apps/service/src/modules/tasks/index.ts`

它现在只是对旧实现的 shim，不应该继续承载新设计。

目标状态应当是：

1. 新代码放在 `apps/service/src/modules/task`
2. `apps/service/src/modules/tasks` 只保留极短期过渡兼容，随后删除
3. 不再把新设计继续堆回任何旧实现目录

也就是说：

`tasks` 是迁移壳，`task` 才是新的 canonical module。

## 14. 迁移顺序建议

### 14.1 Phase 1

先补 task 设计文档与 TDD 计划，锁定：

1. `task` owns `Task`
2. `task` 不拥有 raw runtime events
3. `task` 不拥有 websocket contract
4. `task` 不默认拥有 hierarchy / lineage / orchestration relation

### 14.2 Phase 2

新建 `modules/task` skeleton：

1. domain task aggregate
2. command / query ports
3. in-memory test doubles

### 14.3 Phase 3

优先迁 command / query：

1. `GetTaskDetail`
2. `ListProjectTasks`
3. `ArchiveTask`
4. `DeleteTask`
5. `UpdateTaskTitle`

这几项对 runtime 的耦合最小，适合先转正。

### 14.4 Phase 4

再迁执行相关 command：

1. `CreateTask`

这阶段需要以 facade / port 的方式消费 current runtime integration，不要直接把旧 runner 逻辑拷进新 task。

### 14.5 Phase 5

最后再处理：

1. task event query projection
2. task notification adapter / subscriber
3. current runtime integration facade 收紧

## 15. 一句话结论

新的 `task` context 不应该再是“任务 + 运行时 + 事件摄取 + websocket”的总包。

长期正确表达应该是：

```text
Task owns user-visible work units, lifecycle, and task-facing read models.
Runtime owns execution sessions and raw runtime events.
Interaction only delivers task changes to clients.
```
