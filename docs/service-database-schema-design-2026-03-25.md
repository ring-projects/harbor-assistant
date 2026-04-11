# Service Database Schema Design

## 1. 文档信息

- 文档名称：Service Database Schema Design
- 日期：2026-03-25
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/prisma/models`
  - `apps/service/src/modules/project`
  - `apps/service/src/modules/task`
  - future runtime execution persistence redesign
- 关联文档：
  - [backend-lite-ddd-design-2026-03-24.md](./backend-lite-ddd-design-2026-03-24.md)
  - [project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
  - [orchestration-requirements-2026-03-31.md](./orchestration-requirements-2026-03-31.md)
  - [task-event-storage-model.md](./task-event-storage-model.md)
  - [agent-event-projection-design-2026-03-25.md](./agent-event-projection-design-2026-03-25.md)

## 2. 文档目标

这份文档只回答一个问题：

当前 `apps/service` 的数据库模型应该如何重新建模，才能与已经收敛过的模块边界保持一致。

这里不是在旧 schema 上继续打补丁，也不是讨论“怎样最小迁移”。

当前判断是：

```text
We should define a new canonical schema and cut over to it.
The existing schema is not the design source of truth.
```

## 3. 为什么现在要重建

现在继续在旧 schema 上做兼容，收益已经很低，成本已经很高。

主要原因有四个：

1. 当前 `Task` 表同时承载 task 语义、runtime 启动快照、执行结果和日志字段，边界已经混杂
2. 当前 `Project` 表附近还保留了过早固化的集成子实体，例如 `ProjectMcpServer`
3. 我们已经在模块层完成了 `project / task / interaction / runtime` 的边界收敛，旧表结构反而开始阻碍实现
4. 当前重构目标本来就是 hard-cut convergence，而不是保留历史兼容

因此这次 schema 设计采用的策略是：

1. 以当前模块边界为准，不以旧表结构为准
2. 允许删除旧字段和旧表
3. 不为“历史兼容”保留名义上的关系字段
4. 如果需要数据迁移，优先考虑重建或导入，而不是兼容性字段常驻

## 4. 建模总原则

### 4.1 先按 bounded context 建模，再按表实现

当前数据库模型必须服从以下边界：

1. `project` 拥有项目身份与项目级默认策略
2. `task` 拥有用户可见任务语义
3. `runtime execution` 拥有一次执行尝试的技术上下文
4. `runtime raw event` 是执行事件的 source of truth

### 4.2 不把一次执行塞回 `Task`

`Task` 是业务工作单元，不是 provider session。

所以以下信息不应直接作为 `Task` 的主字段：

1. `threadId`
2. `executor`
3. `model`
4. `executionMode`
5. `command`
6. `stdout`
7. `stderr`
8. `error`
9. `exitCode`
10. `projectPath` 快照

这些信息都属于“一个持续 execution session”。

### 4.3 raw event 挂到 execution，而不是 task

当前已经接受的原则是：

1. raw agent event 是 source of truth
2. projection 在读取时完成

进一步收敛后，应当明确：

raw event 属于一次 execution，不直接属于 task 抽象本身。

否则未来遇到：

1. retry
2. continue after interruption
3. different executor run
4. future orchestration replay

事件流就会在 `taskId` 下被错误混合。

### 4.4 不为尚未稳定的子域过早固化表结构

例如：

1. `ProjectMcpServer`
2. future orchestration entities
3. future task tree / lineage

如果这些对象当前还没有稳定领域语义，就不应先进入 canonical schema。

## 5. 新的核心存储模型

新的 canonical schema 建议只先保留四个核心模型：

1. `Project`
2. `Task`
3. `Execution`
4. `ExecutionEvent`

一句话总结：

```text
Project stores project truth.
Task stores task truth.
Execution stores one execution session.
ExecutionEvent stores raw runtime events for that execution.
```

## 6. Project 模型

### 6.1 Project 的目标职责

`Project` 只表达：

1. 项目身份
2. 项目目录语义
3. 项目生命周期
4. 项目级默认策略

### 6.2 推荐字段

推荐第一版 canonical fields：

- `id`
- `name`
- `slug`
- `rootPath`
- `normalizedPath`
- `description`
- `status`
- `lastOpenedAt`
- `createdAt`
- `updatedAt`
- `archivedAt`
- `defaultExecutor`
- `defaultModel`
- `defaultExecutionMode`
- `maxConcurrentTasks`
- `logRetentionDays`
- `eventRetentionDays`
- `harborSkillsEnabled`
- `harborSkillProfile`

### 6.3 关于 ProjectSettings

领域上，`ProjectSettings` 仍然是 `Project` 的 owned record。

但在数据库层，当前更推荐直接内联到 `projects` 表，而不是保留单独的 `project_settings` 1:1 表。

原因：

1. 当前 settings 体量小
2. 当前没有独立查询价值
3. 当前没有独立生命周期
4. 继续拆表只会增加 Prisma 映射与事务样板

如果将来 settings 体量增长，再考虑拆表，但那应是后续优化，而不是现在的基线。

### 6.4 当前建议删除的表

第一版建议从 canonical schema 中移除：

1. `ProjectMcpServer`

理由不是“永远不需要”，而是：

1. 当前它没有稳定业务入口
2. 当前它不是主线能力
3. 当前它会干扰 project 聚合的收敛

## 7. Task 模型

### 7.1 Task 的目标职责

`Task` 只表达用户可见任务语义：

1. 它属于哪个项目
2. 用户让它做什么
3. 它当前对用户显示成什么生命周期状态
4. 标题是否来自 prompt / agent / user

### 7.2 推荐字段

推荐第一版 canonical fields：

- `id`
- `projectId`
- `prompt`
- `title`
- `titleSource`
- `status`
- `archivedAt`
- `createdAt`
- `updatedAt`
- `startedAt`
- `finishedAt`

### 7.3 当前建议删除的字段

下列字段建议从 `Task` 表移除：

1. `projectPath`
2. `executor`
3. `executionMode`
4. `model`
5. `threadId`
6. `exitCode`
7. `command`
8. `stdout`
9. `stderr`
10. `error`
11. `parentTaskId`
12. `titleUpdatedAt`

原因分别是：

1. 前十项属于 execution 语义，不属于 task 聚合
2. `parentTaskId` 属于 orchestration / lineage 语义，当前已明确不属于 task 基础语义
3. `titleUpdatedAt` 是过细粒度的审计字段，`updatedAt` 已足够表达 task 被修改这一事实

## 8. Execution 模型

### 8.1 为什么需要单独 Execution

只要系统允许：

1. start
就必须把“任务”和“执行过程”拆开。

`Execution` 的职责是：

1. 保存一个持续 execution session 的 runtime 配置快照
2. 保存这个 execution 的 provider/session 关联
3. 保存这个 execution 的技术完成状态
4. 表达这个 execution 属于哪个业务宿主

### 8.2 推荐字段

推荐第一版 canonical fields：

- `id`
- `ownerType`
- `ownerId`
- `executorType`
- `executorModel`
- `executionMode`
- `workingDirectory`
- `sessionId`
- `status`
- `startedAt`
- `finishedAt`
- `exitCode`
- `errorMessage`
- `command`
- `createdAt`
- `updatedAt`

说明：

1. `ownerType` / `ownerId` 表示一次 execution 属于哪个业务宿主
2. `executorType` 表示这次执行由哪个 executor/runtime 处理，例如 `codex` 或 `claude-code`
3. `workingDirectory` 表示 execution 绑定的工作目录
4. `sessionId` 表示 provider/session 标识，例如 thread id
5. `status` 是 execution 层状态，不等于 task 聚合的最终业务语义
6. `errorMessage` 只表示 execution 失败信息，不替代 task-facing projection

### 8.3 Resume / Retry 语义

当前设计明确采用以下约束：

1. `resume` 是继续同一个 `Execution`
2. `retry` 也默认继续同一个 `Execution`
3. `resume` / `retry` 都不创建新的 `Execution`
4. 原因是 execution 持有真正的 session 上下文，重新创建 execution 往往意味着重新创建 agent session，会丢失上下文并浪费 token
5. service 重启后不会自动继续旧的 in-flight turn，而是先把 orphaned `queued` / `running` execution 收敛到 `failed`
6. 如果 execution 已记录 `sessionId`，后续仍允许在同一个 execution 上继续 `resume`

因此在第一版里：

1. 一个 `Task` 默认只拥有一个 `Execution`
2. 所有 runtime 事件都持续追加到同一个 `ExecutionEvent` 流
3. 应用层如果提供“恢复任务”“重试任务”入口，本质上都是对既有 execution 发起继续运行
4. 只有未来明确出现“放弃旧上下文，强制新开一轮独立 session”的业务语义时，才值得引入新的 execution 记录

### 8.4 Task 与 Execution 的关系

在当前第一版里，`Task` 仍然是主要宿主之一。

但新的 schema 不应把 execution 的 identity 固定写成 task 专属关系，而应通过 owner 关系表达：

1. `ownerType = "task"`
2. `ownerId = task.id`

这样 future 如果还有：

1. project-level analysis execution
2. other LLM-backed workflow execution

数据库层不需要再重命名 execution 模型。

当前推荐关系可读成：

1. 当前第一版里，一个 `Task` 对应一个 `Execution`
2. `resume` / `retry` 都在这个 execution 上继续追加历史
3. 因此当前不需要在 `Task` 表里预埋 `currentExecutionId`
4. 如果未来真的出现“同一业务宿主需要多个独立 execution session”的稳定场景，再放开成 `1 --- n`

## 9. ExecutionEvent 模型

### 9.1 目标职责

`ExecutionEvent` 保存 raw runtime event stream。

它是 runtime execution 的 canonical history record。

### 9.2 推荐字段

推荐第一版 canonical fields：

- `id`
- `executionId`
- `sequence`
- `source`
- `rawEventType`
- `rawPayload`
- `createdAt`

可选预留字段：

- `externalId`
- `schemaVersion`

字段语义建议：

1. `source` 表示这条事件的事实来源
2. 第一版不拆成 `sourceType` / `sourceName`，避免人为维护两层真相
3. `rawEventType` 保留原始协议事件名称，不使用投影后的 normalized 名称

当前推荐值：

1. `source`: `codex` | `claude-code` | `harbor`

设计判断：

1. 如果事件来自 agent runtime，那么 `source` 直接记录 provider identity 即可
2. 如果事件来自系统合成事件，那么 `source` 记录系统组件名，例如 `harbor`
3. 未来只有在“来源类别”和“来源实例”真的需要独立查询维度时，才值得重新拆成两列

### 9.3 为什么不直接挂在 taskId 下

因为 event stream 语义属于一次 execution。

如果仍然直接挂在 `taskId` 下，未来在以下场景会产生歧义：

1. retry 后 sequence 是否重置
2. 多次执行的 raw event 是否混合
3. 不同 executor 的 event 是否共享一条主流
4. 某次 execution 的审计如何单独导出

## 10. 推荐关系图

```text
Project 1 --- n Task
Task    1 --- 1 Execution   where ownerType = "task"
Execution 1 --- n ExecutionEvent
```

这就是第一版 canonical schema 的最小稳定核心。

## 11. 当前 schema 到新 schema 的映射判断

### 11.1 Project

当前 `Project` 主体字段大多可以保留，但建议做两件事：

1. 把 `ProjectSetting` 内联回 `Project`
2. 移除 `ProjectMcpServer`

### 11.2 Task

当前 `Task` 表应做拆分：

1. task 业务字段保留在 `Task`
2. runtime 快照和执行结果迁到 `Execution`
3. raw event 从 `TaskAgentEvent(taskId)` 改为 `ExecutionEvent(executionId)`

### 11.3 明确删除 lineage 设计

当前 `parentTaskId` 不应迁移。

它不属于当前 canonical model。

后续如果确实要做多 agent orchestration，应新建独立模型，而不是把 lineage 偷偷塞回 `Task`。

## 12. 索引建议

### 12.1 Project

推荐索引：

1. `normalizedPath` unique
2. `slug` unique
3. `(status, updatedAt desc)`

### 12.2 Task

推荐索引：

1. `(projectId, createdAt desc)`
2. `(projectId, archivedAt, createdAt desc)`
3. `(status, createdAt desc)`

### 12.3 Execution

推荐索引：

1. `(ownerType, ownerId)` unique
2. `(status, createdAt desc)`
3. `(sessionId, status, createdAt desc)` optional

### 12.4 ExecutionEvent

推荐索引：

1. `(executionId, sequence)` unique
2. `(executionId, createdAt asc)`
3. `(executionId, source, sequence)`
4. `(executionId, rawEventType, sequence)`

## 13. 非目标

这份文档当前不试图定义：

1. orchestration schema
2. task tree / lineage schema
3. MCP registry schema
4. frontend cache schema
5. analytics / BI materialized views

这些能力未来可以存在，但不应阻碍当前 canonical schema 收敛。

## 14. 实施建议

推荐按下面顺序落地：

1. 先确认这份文档作为 canonical storage direction
2. 重写 `apps/service/prisma/models/project.prisma`
3. 重写 `apps/service/prisma/models/task.prisma`
4. 生成新的基线迁移
5. 改 `project` 与 `task/runtime` 的 Prisma repository
6. 删除所有对旧字段的映射与兼容逻辑

### 14.1 当前建议采用 hard-cut

当前判断是不继续为旧 schema 保留兼容字段。

也就是说：

1. 不新增 `legacyTaskId`
2. 不保留 `parentTaskId`
3. 不保留旧 task runtime 快照字段在 `Task` 表上
4. 如需保留历史数据，优先导出后重建，而不是长期共存

## 15. 最终结论

当前更优策略不是“继续修旧表”，而是：

```text
Define a new canonical schema from current bounded-context boundaries,
then cut the implementation over to it.
```

对于当前系统，新的 canonical schema 应以：

1. `Project`
2. `Task`
3. `Execution`
4. `ExecutionEvent`

作为第一版稳定基线。
