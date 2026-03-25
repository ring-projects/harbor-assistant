# Task / Runtime System Design Rethink

## 1. 文档信息

- 文档名称：Task / Runtime System Design Rethink
- 日期：2026-03-23
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/project`
  - future `apps/service/src/modules/runtime`
  - `apps/service/src/modules/tasks`
  - future runtime policy resolution capability in application layer
- 关联文档：
  - [task-api.md](./task-api.md)
  - [project-api.md](./project-api.md)
  - [task-event-storage-model.md](./task-event-storage-model.md)
  - replaces older task/runtime boundary and implementation drafts removed from `docs/`

## 2. 核心前提

这次重新设计必须先写死一个前提：

`AgentSession` 不是“单次运行 attempt”。

`AgentSession` 的真实语义是：

1. 一个 Harbor 内部管理的长期 runtime context
2. 这个 context 基于 provider 的可持续 session/thread
3. 它可以被启动
4. 它可以被 resume
5. 它可以在失败后继续恢复
6. 它可以在同一 context 内继续 followup / retry

对 Codex 来说，这个抽象本质上对应的是“一个可持续、可恢复的 codex session 在 Harbor 中的持久化表达”。

因此：

1. `AgentSession` 不应被建模成单次 `start -> finish` 的 attempt
2. 不应再额外引入一个与 `AgentSession` 平行的长期上下文实体
3. `TaskExecution` 不应作为 `Task` 与 `AgentSession` 之间的默认桥梁
4. `RunAttempt` 也不应在第一版成为核心实体

## 3. 总体判断

系统主轴模块收敛为下面三个核心上下文更合适：

1. `project`
2. `runtime`
3. `task`

但必须明确：

1. `project` 和 `task` 是业务模块
2. `runtime` 是平台执行模块
3. 运行策略决议不是独立业务域，更适合作为应用层能力存在

## 4. 模块边界

### 4.1 `project`

`project` 是业务上下文根，负责：

1. project identity
2. workspace root
3. project settings 持久化
4. project-local skill bridge
5. project memory / future project-scoped shared resources

它不负责：

1. task orchestration
2. runtime lifecycle
3. raw runtime event persistence

### 4.2 `task`

`task` 是用户可见工作单元，负责：

1. task record
2. task list / detail / archive / delete
3. task tree / parent-child lineage
4. create / followup / retry / subtask 等业务动作
5. task-oriented query/read model
6. task status projection
7. `/tasks/:taskId/events` 这种 task 视角接口

它不负责：

1. provider runtime integration
2. raw runtime event source of truth
3. provider session/thread 底层管理

### 4.3 `runtime`

`runtime` 是执行平台模块，负责：

1. `AgentSession` lifecycle
2. provider adapter
3. start / resume / cancel / recover
4. raw event ingestion
5. raw event persistence
6. runtime-oriented query

它不负责：

1. task business rule
2. task tree
3. project-specific orchestration policy
4. task-facing normalized view model

### 4.4 `runtime-policy`

`runtime-policy` 不是独立上下文，而是应用层能力，负责：

1. env / feature flag / service default
2. project settings 读取后的决议逻辑
3. request override 合并
4. resolved runtime config / runtime policy 计算

它不负责：

1. `ProjectSettings` 的主存储
2. runtime 执行
3. task 状态机

## 5. 第一版核心模型

### 5.1 `Project`

`Project` 是业务上下文。

第一版继续保持现有方向：

```ts
Project {
  id: string
  name: string
  rootPath: string
  normalizedPath: string
  status: "active" | "archived" | "missing"
  createdAt: string
  updatedAt: string
}
```

### 5.2 `ProjectSettings`

`ProjectSettings` 属于 `project` 模块，不属于单独配置模块。

```ts
ProjectSettings {
  projectId: string
  defaultExecutor: string | null
  defaultModel: string | null
  defaultExecutionMode: string | null
  maxConcurrentTasks: number
  harborSkillsEnabled: boolean
  logRetentionDays: number | null
  eventRetentionDays: number | null
  createdAt: string
  updatedAt: string
}
```

### 5.3 `Task`

`Task` 是用户可见的业务工作单元。

```ts
Task {
  id: string
  projectId: string
  title: string
  prompt: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  agentSessionId: string
  parentTaskId: string | null
  triggeredByTaskId: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}
```

说明：

1. 第一版推荐 `Task -> AgentSession` 为 `1:1`
2. 一个 task 就代表一个长期 runtime context
3. followup / retry / recover 发生在同一个 `AgentSession` 上
4. subtask 永远建成新的 `Task`

### 5.4 `AgentSession`

`AgentSession` 是长期、可恢复的 runtime context。

```ts
AgentSession {
  id: string
  projectId: string
  taskId: string
  agentType: "codex" | "claude-code"
  providerSessionId: string
  workingDirectory: string
  status: "idle" | "running" | "completed" | "failed" | "cancelled"
  currentModel: string | null
  lastError: string | null
  startedAt: string | null
  lastActiveAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}
```

说明：

1. `providerSessionId` 是真实 provider session/thread id
2. `AgentSession` 本身就是 Harbor 对这个长期 session 的管理对象
3. 第一版不再额外引入与之平行的 `AgentRun`

### 5.5 `AgentEventRecord`

`AgentEventRecord` 是 runtime raw event source of truth。

```ts
AgentEventRecord {
  id: string
  sessionId: string
  sequence: number
  agentType: string
  rawEventType: string
  rawPayload: string
  createdAt: string
}
```

说明：

1. raw event 归属于 `AgentSession`
2. `sequence` 在单个 session 内单调递增
3. `task` 模块不重复持久化同义 raw event

## 6. 关键关系

第一版推荐关系如下：

```text
Project
  1 -> n Task

Task
  1 -> 1 AgentSession

AgentSession
  1 -> n AgentEventRecord
```

补充关系：

1. `Task.parentTaskId` 用于 task lineage
2. `Task.triggeredByTaskId` 可用于记录哪个 parent task 触发了 child task
3. `AgentSession.taskId` 与 `Task.agentSessionId` 应保持一致，第一版建议做唯一约束

## 7. 为什么第一版不引入其他实体

### 7.1 不引入 `TaskExecution`

原因：

1. 当前没有“execution 级别”的独立生命周期
2. 当前没有“execution 级别”的独立查询需求
3. 如果 `TaskExecution` 只是 `Task -> AgentSession` 的桥，它没有独立业务价值

### 7.2 不引入 `AgentRun`

原因：

1. `AgentSession` 已经承担长期 provider session 的管理职责
2. 再建平行的 `AgentRun` 会形成重复抽象
3. 当前没有比 `AgentSession` 更独立的一层 runtime aggregate 需求

### 7.3 不引入 `RunAttempt`

原因：

1. `start / resume / retry / recover` 先作为 `AgentSession` 的 lifecycle 行为处理即可
2. 当前没有 attempt 级别的独立 API、独立报表、独立审计需求
3. 如果需要记录边界，第一版可先通过 raw event 或 synthetic event 表达

## 8. 生命周期设计

### 8.1 create task

create task 时：

1. 创建 `Task`
2. 创建 `AgentSession`
3. 建立 `Task.agentSessionId = AgentSession.id`
4. runtime 启动这个 session
5. raw event 写入 `AgentEventRecord`

### 8.2 followup task

followup 时：

1. 不创建新 task
2. 不创建新 session
3. 对现有 `AgentSession` 发起继续执行
4. 新事件继续追加到同一个 session 的 event stream

### 8.3 retry task

第一版推荐语义：

1. retry 默认在同一个 `AgentSession` 内继续
2. 只有当业务明确要求“放弃旧 context，重开新 context”时，才允许新建新的 `Task + AgentSession`
3. 不建议把“session 内 retry”和“新 session 重跑”混成一个动作

### 8.4 recover session

服务重启或连接中断后恢复时：

1. 恢复的是同一个 `AgentSession`
2. 不是创建新的 `Task`
3. 也不是创建新的“执行桥梁实体”

### 8.5 subtask

subtask 的规则：

1. subtask 一定是新的 `Task`
2. subtask 默认拥有自己的 `AgentSession`
3. lineage 通过 `parentTaskId` 表达
4. runtime 不理解 subtask 业务含义

## 9. 状态 ownership

### 9.1 `AgentSession.status`

`AgentSession.status` 由 `runtime` 模块维护。

推荐状态：

1. `idle`
2. `running`
3. `completed`
4. `failed`
5. `cancelled`

说明：

1. 这是 session 级别状态，不是 task 级别状态
2. 它表示长期 runtime context 当前是否仍可继续、是否已结束

### 9.2 `Task.status`

`Task.status` 由 `task` 模块维护。

推荐规则：

1. create task 后写入 `queued`
2. session 实际进入执行时写入 `running`
3. session 收敛到 terminal 后，task 收敛到 `completed | failed | cancelled`

约束：

1. `Task.status` 不能独立于 `AgentSession.status` 演化
2. `Task.status` 是 task 对 runtime 状态的业务投影
3. 不允许 runtime 直接反向写 task 业务字段

## 10. `/tasks/:taskId/events` 查询语义

`/tasks/:taskId/events` 继续是 task 视角接口，不直接暴露 raw event。

读取路径：

```text
Task
  -> AgentSession
    -> AgentEventRecord[]
      -> task-view projector
        -> normalized task events
```

约束：

1. raw event source of truth 在 `runtime`
2. normalized task event 由 `task` 模块在 query 时 projection
3. `task` 模块不再持久化一份同义 raw event

关于 cursor：

1. `afterSequence` 与 `nextSequence` 继续是 projected sequence
2. 由于第一版 `Task -> AgentSession` 是 `1:1`，不会遇到多 session 合流排序问题
3. 如果未来 task 允许关联多个 session，再重新定义跨 session cursor contract

## 11. 运行策略决议链

这里不建议先引入独立配置上下文。

更合适的做法是由应用层 `RuntimePolicyResolver` 负责决议。

推荐决议链：

```text
SystemConfig
  + ProjectSettings
  + Task request overrides
  -> ResolvedRuntimeConfig
  -> runtime.startOrResumeSession(...)
```

`ResolvedRuntimeConfig` 第一版可包含：

1. `agentType`
2. `model`
3. `executionMode`
4. `approvalPolicy`
5. `sandboxPolicy`
6. `workingDirectory`
7. `webSearchPolicy`

## 12. API 归属建议

### 属于 `project`

1. `/projects`
2. `/projects/:id`
3. `/projects/:id/settings`

### 属于 `task`

1. `/tasks`
2. `/tasks/:taskId`
3. `/tasks/:taskId/events`
4. `/tasks/:taskId/followup`
5. `/tasks/:taskId/retry`
6. `/tasks/:taskId/archive`
7. `/tasks/:taskId/delete`

### 属于 `runtime`

第一版建议不直接对前端暴露通用 `/sessions/...` API。

内部能力可先作为 module service 存在：

1. `startSession`
2. `resumeSession`
3. `cancelSession`
4. `appendRawEvent`
5. `listSessionRawEvents`

### 属于 `runtime-policy`

第一版通常不需要单独对前端暴露运行策略决议 API。

## 13. 实施顺序

### Phase 1: 先收敛模型认知

1. 统一 `AgentSession` 的真实语义
2. 不再把 `AgentSession` 当成单次 attempt
3. 暂不引入 `TaskExecution` / `AgentRun` / `RunAttempt`

### Phase 2: 抽 runtime 模块

1. 从 `tasks` 中迁出 provider integration
2. 从 `tasks` 中迁出 raw event ingestion / persistence
3. 新建 runtime-oriented repository / service

### Phase 3: 建立 `Task -> AgentSession`

1. 给 `Task` 增加 `agentSessionId`
2. 建立 `AgentSession.taskId`
3. 把 provider session/thread id 放入 `AgentSession.providerSessionId`

### Phase 4: 重写 task query

1. `/tasks/:taskId/events` 改为通过 `Task -> AgentSession -> AgentEventRecord` 读取
2. 保持前端 normalized contract 不变

### Phase 5: 再考虑是否需要更细粒度抽象

只有在出现明确需求时，再评估是否新增：

1. `RunAttempt`
2. `TaskExecution`
3. `AgentRun`

## 14. 最终判断

基于当前对 Codex session 语义的澄清，第一版更合理的系统主模型是：

```text
Project -> Task -> AgentSession -> AgentEventRecord
```

其中：

1. `Task` 是业务工作单元
2. `AgentSession` 是长期、可恢复的 runtime context
3. `AgentEventRecord` 是 raw runtime history
4. `ProjectSettings` 属于 `project`
5. `runtime-policy` 只负责决议，不负责 owning business entity

这比引入 `TaskExecution`、`AgentRun`、`RunAttempt` 的多层中间抽象更适合当前阶段。
