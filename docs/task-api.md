# Task 接口文档

> [!WARNING]
> **状态：部分过时（Partially Superseded）**
> 当前系统主模型已调整为 `Orchestration -> N Tasks`。
> 其中 task detail / task events / resume / cancel / archive / delete 仍可作为当前 contract 参考，
> 但 task create 与 task list 的 project 维度入口已经失效。
> 请优先参考：`docs/orchestration-requirements-2026-03-31.md` 与 `docs/tdd/orchestration.md`。


本文档描述当前 `task` 模块的真实 HTTP contract 与 resume 语义，用于前端对接、联调和后续重构基线。

注意：

- 当前 canonical 模块路径是 `apps/service/src/modules/task`
- 当前 canonical create/list 入口已经是 orchestration 维度：
  - `POST /v1/orchestrations/:orchestrationId/tasks`
  - `GET /v1/orchestrations/:orchestrationId/tasks`
- 早期 `followup / retry / break / task-input-images` 相关接口已经不再是当前 contract
- 当前“继续执行”的唯一 canonical 语义是：`resume` 在同一个 `Execution` 上继续运行
- service 启动时会把 orphaned `queued` / `running` execution 收敛到 `failed`
- Harbor 当前不会在 service 重启后自动继续旧的 in-flight turn

范围覆盖：

- `apps/service/src/modules/task`
- `HTTP API`
- task event 查询契约
- task 与 execution 的 resume 关系

## 1. 概览

- 基础模型：`Task`
- 任务状态：`queued | running | completed | failed | cancelled`
- 执行器：当前支持 `codex`、`claude-code`
- 事件存储：数据库保存 raw runtime events
- 事件对外读取：`GET /v1/tasks/:taskId/events` 返回 projected normalized event stream
- terminal task 可通过 `POST /v1/tasks/:taskId/resume` 在同一个 execution session 上继续运行

当前任务模块已经完成以下分层：

1. adapter 输出原始 runtime envelope
2. repository 持久化 raw event
3. service query 在读取时将 raw event 投影成 `TaskAgentEventStream`
4. 前端当前仍消费 normalized event stream，不直接消费 raw storage record

## 2. 数据模型

来源：

- `apps/service/src/modules/task/domain/task.ts`
- `apps/service/src/modules/task/application/task-runtime-port.ts`
- `apps/service/prisma/models/task.prisma`
- `apps/service/prisma/models/execution.prisma`

### 2.1 `Task`

```ts
type Task = {
  id: string
  projectId: string
  prompt: string
  title: string
  titleSource: "prompt" | "agent" | "user"
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
}
```

时间字段均为 ISO 时间字符串。

### 2.2 `RuntimePolicy`

```ts
type RuntimePolicy = {
  sandboxMode: "read-only" | "workspace-write" | "danger-full-access"
  approvalPolicy: "never" | "on-request" | "untrusted"
  networkAccessEnabled: boolean
  webSearchMode: "disabled" | "cached" | "live"
  additionalDirectories: string[]
}
```

### 2.3 `TaskAgentEvent`

对外接口返回的事件流仍使用 normalized 结构：

```ts
type TaskAgentEvent = {
  id: string
  taskId: string
  sequence: number
  eventType: string
  payload: Record<string, unknown>
  createdAt: string
}

type TaskAgentEventStream = {
  taskId: string
  items: TaskAgentEvent[]
  nextSequence: number
}
```

### 2.4 `StoredTaskRawEvent`

数据库内部存储的是 raw event：

```ts
type StoredTaskRawEvent = {
  id: string
  taskId: string
  sequence: number
  agentType: "codex" | "claude-code"
  rawEventType: string
  rawPayload: Record<string, unknown>
  createdAt: string
}
```

注意：

- `StoredTaskRawEvent` 不是当前 `/v1/tasks/:taskId/events` 的对外返回格式
- raw event 是 source of truth
- normalized `TaskAgentEvent` 是 query projection 结果

## 3. 事件模型说明

来源：

- `apps/service/src/modules/task/infrastructure/runtime/normalize-agent-events.ts`
- `apps/service/src/modules/task/infrastructure/runtime/task-execution-driver.ts`
- `apps/service/src/modules/task/infrastructure/projection/prisma-task-event-projection.ts`

### 3.1 存储策略

当前系统不会把 Harbor 统一事件直接落库。

真实流程是：

1. agent adapter 产出 `RawAgentEventEnvelope`
2. gateway 将 `agentType + rawEventType + rawPayload` 持久化
3. 同一个 raw event 在 query 时可被投影为 0 到多条 normalized event

### 3.2 当前已覆盖的 raw event 来源

Harbor synthetic：

- `harbor.user_prompt`
- `harbor.session.started`
- `harbor.turn.started`
- `harbor.turn.completed`
- `harbor.error`

Codex runtime：

- `thread.started`
- `turn.started`
- `turn.completed`
- `turn.failed`
- `error`
- `item.started`
- `item.updated`
- `item.completed`

Claude runtime：

- `system.init`
- `assistant`
- `user`
- `result`
- `system.result`
- `error`

### 3.3 `/events` 的返回语义

`GET /v1/tasks/:taskId/events` 返回的是 normalized 事件，不是 raw 数据。

因此：

- 接口消费者不需要理解 Codex / Claude 原始协议差异
- 但也不能假设数据库中保存的是 `eventType + payload`
- 如果后续需要调试原始 runtime event，应新增专门 raw query 接口，而不是改变现有 `/events` 返回形态

### 3.4 sequence 语义

当前实现里，`/v1/tasks/:taskId/events` 直接按 `ExecutionEvent.sequence` 返回事件序号。

因此：

- `/events` 的 `afterSequence` 应继续传上一次响应中的 `nextSequence`
- 当前没有额外的 projected stride sequence 层
- 如果未来引入更复杂的 read-model projection，再单独调整 contract 文档

## 4. Service 层接口

来源：

- `apps/service/src/modules/task/routes/index.ts`
- `apps/service/src/modules/task/application/*`

### 4.1 `POST /v1/orchestrations/:orchestrationId/tasks`

```ts
function createTask(input: {
  orchestrationId: string
  projectId: string
  prompt?: string
  items?: AgentInputItem[]
  title?: string
  executor: string
  model: string
  executionMode: string
  effort: TaskEffort
}): Promise<Task>
```

行为：

- `orchestrationId.trim()` 为空时抛 `INVALID_REQUEST_BODY`
- `projectId.trim()` 为空时抛 `INVALID_REQUEST_BODY`
- `prompt / items` 至少提供一个
- 若项目不存在，抛 `PROJECT_NOT_FOUND`
- orchestration 必须存在且属于对应 project
- `executor / model / executionMode / effort` 必须显式传入
- 创建 task record 后立即启动 runtime execution
- 若 runtime 无法开始，`task` 与 `execution` 会一起收敛为 `failed`
- route 响应返回 task 本身；实时状态变化依赖 websocket / query 刷新

### 4.2 `POST /v1/tasks/:taskId/resume`

```ts
function resumeTask(input: {
  taskId: string
  prompt: string
}): Promise<Task>
```

约束：

- 原 task 必须存在
- 原 task 必须是 terminal 状态
- 原 task 不能已归档
- task 对应 execution 必须存在 provider session
- 当前 resume 不允许切换 executor / executionMode，也不创建新的 execution
- 成功后 execution 会回到 `running`，task 也会重新回到 `running`

关键语义：

- `resume` 是同一个 execution 的继续运行
- 不是新的 child task
- 也不是新的 execution attempt

### 4.3 Service Restart Recovery

当前实现的 restart semantics 明确如下：

- service 启动时会扫描 `Execution.status in (queued, running)` 的 task-owned execution
- 这类 orphaned execution 会被统一标记为 `failed`
- Harbor 会追加一条 synthetic `error` event 说明失败原因
- 若 execution 已记录 `sessionId`，后续仍允许用户通过 `POST /v1/tasks/:taskId/resume` 继续同一个 execution
- Harbor 当前不会在 service 重启时自动继续旧的 in-flight turn

### 4.5 `updateTaskTitle(input)`

```ts
function updateTaskTitle(input: {
  taskId: string
  title: string
}): Promise<Task>
```

行为：

- `taskId` 为空时报 `INVALID_REQUEST_BODY`
- `title.trim()` 为空时报 `INVALID_TASK_TITLE`
- 标题更新会写回当前 task record，并发布 `task_upserted`

### 4.6 `archiveTask(input)`

```ts
function archiveTask(input: {
  taskId: string
}): Promise<Task>
```

行为：

- 仅允许 terminal task 归档
- 已归档 task 再次归档时返回冲突错误

### 4.7 `deleteTask(input)`

```ts
function deleteTask(input: {
  taskId: string
}): Promise<{
  taskId: string
  projectId: string
}>
```

行为：

- 仅允许 terminal task 删除
- 删除成功后会发布 `task_deleted` realtime 事件

### 4.8 `getTaskDetail(taskId)`

```ts
function getTaskDetail(taskId: string): Promise<Task>
```

行为：

- 空 `taskId` 由 route schema 拦截为 `INVALID_REQUEST_BODY`
- 不存在抛 `TASK_NOT_FOUND`

### 4.9 `listProjectTasks(input)`

```ts
function listProjectTasks(input: {
  projectId: string
  limit?: number
  includeArchived?: boolean
}): Promise<Task[]>
```

行为：

- 当前实现直接按 `projectId` 查询 task 记录，不额外校验 project detail
- `includeArchived !== true` 时排除已归档 task

### 4.10 `getTaskEvents(input)`

```ts
function getTaskEvents(input: {
  taskId: string
  afterSequence?: number
  limit?: number
}): Promise<{
  task: Task
  events: TaskAgentEventStream
  isTerminal: boolean
}>
```

行为：

- 先读取 task detail
- 当前实现直接用 `ExecutionEvent.sequence > afterSequence` 作为 cursor
- repository 读取 raw events
- service 再做 raw -> normalized projection

注意：

- repository 返回的并不是最终对外事件流
- service 层才是 `/events` 的语义边界

## 5. HTTP API

来源：

- `apps/service/src/modules/orchestration/routes/index.ts`
- `apps/service/src/modules/task/routes/index.ts`
- `apps/service/src/modules/task/schemas/task.schema.ts`

以下路径均以 `/v1` 为前缀。

### 5.1 `POST /v1/orchestrations/:orchestrationId/tasks`

请求体：

```json
{
  "orchestrationId": "orch-id",
  "projectId": "project-id",
  "items": [
    { "type": "text", "text": "Run tests" },
    { "type": "local_image", "path": ".harbor/task-input-images/example.png" }
  ],
  "model": "gpt-5",
  "executor": "codex",
  "executionMode": "connected",
  "effort": "medium"
}
```

成功响应：

```json
{
  "ok": true,
  "task": { "...": "CodexTask" }
}
```

常见错误：

- `400 INVALID_REQUEST_BODY`
- `400 INVALID_INPUT`
- `400 INVALID_TASK_EFFORT`
- `404 PROJECT_NOT_FOUND`
- `404 ORCHESTRATION_NOT_FOUND`
- `500 TASK_START_FAILED`

### 5.2 `GET /v1/tasks/:taskId`

成功响应：

```json
{
  "ok": true,
  "task": { "...": "CodexTask" }
}
```

常见错误：

- `400 INVALID_TASK_ID`
- `404 TASK_NOT_FOUND`

### 5.3 `GET /v1/tasks/:taskId/events`

查询参数：

- `afterSequence?: number`
- `limit?: number`

成功响应：

```json
{
  "ok": true,
  "task": { "...": "CodexTask" },
  "events": {
    "taskId": "task-id",
    "nextSequence": 1001,
    "items": [
      {
        "id": "event-id:1",
        "taskId": "task-id",
        "sequence": 1001,
        "eventType": "command.started",
        "payload": {
          "type": "command.started",
          "commandId": "command-1",
          "command": "bun test",
          "timestamp": "2026-03-11T00:00:01.000Z"
        },
        "createdAt": "2026-03-11T00:00:01.000Z"
      }
    ]
  }
}
```

状态码语义：

- `200`
  - task 已进入 terminal 状态
- `206`
  - task 仍处于非 terminal 状态，表示事件流还可能继续增长

关键说明：

- 返回的是 normalized events，不是 raw events
- `afterSequence` 与 `nextSequence` 都是 projected sequence
- 客户端应始终使用上一次返回的 `nextSequence` 继续拉取

### 5.4 `POST /v1/tasks/:taskId/resume`

请求体：

```json
{
  "prompt": "Continue with the refactor"
}
```

成功响应：

```json
{
  "ok": true,
  "task": { "...": "Task" }
}
```

常见错误：

- `400 INVALID_REQUEST_BODY`
- `404 TASK_NOT_FOUND`
- `409 INVALID_TASK_RESUME_STATE`
- `500 TASK_RESUME_FAILED`

关键语义：

- `resume` 继续的是同一个 execution session
- `resume` 不创建新的 task
- `resume` 也不创建新的 execution

### 5.5 `PUT /v1/tasks/:taskId/title`

请求体：

```json
{
  "title": "Refactor task event storage",
  "source": "user"
}
```

常见错误：

- `400 INVALID_TASK_ID`
- `400 INVALID_TASK_TITLE`
- `404 TASK_NOT_FOUND`

### 5.8 `POST /v1/tasks/:taskId/archive`

常见错误：

- `404 TASK_NOT_FOUND`
- `409 INVALID_TASK_ARCHIVE_STATE`
- `500 TASK_ARCHIVE_FAILED`

### 5.9 `DELETE /v1/tasks/:taskId`

成功响应：

```json
{
  "ok": true,
  "taskId": "task-id",
  "projectId": "project-id",
  "orchestrationId": "orch-id"
}
```

常见错误：

- `404 TASK_NOT_FOUND`
- `409 INVALID_TASK_DELETE_STATE`
- `500 TASK_DELETE_FAILED`

### 5.10 `GET /v1/orchestrations/:orchestrationId/tasks`

查询参数：

- `limit?: number`
- `includeArchived?: boolean`

成功响应：

```json
{
  "ok": true,
  "tasks": [{ "...": "CodexTask" }]
}
```

说明：

- 旧的 `GET /v1/projects/:projectId/tasks` 兼容接口已移除
- 当前 task 列表只通过 orchestration 维度读取

### 5.11 `POST /v1/projects/:projectId/task-input-images`

请求体：

```json
{
  "name": "screenshot.png",
  "mediaType": "image/png",
  "dataBase64": "..."
}
```

成功响应：

```json
{
  "ok": true,
  "path": ".harbor/task-input-images/uuid-screenshot.png",
  "mediaType": "image/png",
  "name": "screenshot.png",
  "size": 12345
}
```

行为说明：

- 文件会写入 project 根目录下的 `.harbor/task-input-images`
- 当前支持：
  - `image/png`
  - `image/jpeg`
  - `image/webp`
  - `image/gif`
- 单文件大小上限 10MB
- 返回的 `path` 是相对 project 根目录的相对路径，供 task input 中的 `local_image.path` 使用

## 6. 错误码

来源：

- [errors.ts](../apps/service/src/modules/tasks/errors.ts)

当前 task 模块常见错误码包括：

- `INVALID_PROJECT_ID`
- `INVALID_TASK_ID`
- `INVALID_TASK_TITLE`
- `INVALID_TASK_MODEL`
- `INVALID_PROMPT`
- `PROJECT_NOT_FOUND`
- `TASK_NOT_FOUND`
- `UNSUPPORTED_EXECUTOR`
- `INVALID_TASK_RETRY_STATE`
- `INVALID_TASK_FOLLOWUP_STATE`
- `INVALID_TASK_BREAK_STATE`
- `INVALID_TASK_ARCHIVE_STATE`
- `INVALID_TASK_DELETE_STATE`
- `TASK_BREAK_FAILED`
- `TASK_RETRY_FAILED`
- `TASK_FOLLOWUP_FAILED`
- `TASK_START_FAILED`
- `TASK_ARCHIVE_FAILED`
- `TASK_DELETE_FAILED`
- `READ_ERROR`
- `STORE_READ_ERROR`
- `STORE_WRITE_ERROR`
- `INTERNAL_ERROR`

## 7. 当前接口边界结论

当前 task 后端已经稳定在以下边界：

1. 数据库存 raw events，不存 normalized UI events
2. `/v1/tasks/:taskId/events` 对外继续返回 normalized `TaskAgentEventStream`
3. 前端当前不需要理解 raw runtime envelope
4. 如果后续需要调试、回放、兼容更多 runtime 协议，应该新增 raw query/read model，而不是直接改现有 `/events` contract
