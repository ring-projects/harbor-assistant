# Task 接口文档

本文档描述当前 `tasks` 相关后端接口的真实行为，用于前端对接、联调和后续重构基线。

注意：

- 本文档包含当前实现中的历史字段，例如 `titleUpdatedAt`
- 在新的 canonical schema 设计中，该字段计划删除，标题变更仅使用 `updatedAt` 表达

范围覆盖：

- `apps/service/src/modules/tasks`
- `HTTP API`
- task event 查询契约
- raw event 存储与 query 投影关系

## 1. 概览

- 基础模型：`CodexTask`
- 任务状态：`queued | running | completed | failed | cancelled`
- 执行器：当前支持 `codex`、`claude-code`
- 事件存储：数据库保存 raw runtime events
- 事件对外读取：`GET /v1/tasks/:taskId/events` 返回 projected normalized event stream

当前任务模块已经完成以下分层：

1. adapter 输出原始 runtime envelope
2. repository 持久化 raw event
3. service query 在读取时将 raw event 投影成 `TaskAgentEventStream`
4. 前端当前仍消费 normalized event stream，不直接消费 raw storage record

## 2. 数据模型

来源：

- [types.ts](../apps/service/src/modules/tasks/types.ts)
- [runtime-policy.ts](../apps/service/src/modules/tasks/runtime-policy.ts)

### 2.1 `CodexTask`

```ts
type CodexTask = {
  id: string
  projectId: string
  projectPath: string
  prompt: string
  title: string
  titleSource: "prompt" | "agent" | "user"
  titleUpdatedAt: string | null
  executor: string
  executionMode: "safe" | "connected" | "full-access" | null
  model: string | null
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  threadId: string | null
  parentTaskId: string | null
  archivedAt: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  exitCode: number | null
  command: string[]
  stdout: string
  stderr: string
  error: string | null
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

- [raw-task-events.ts](../apps/service/src/modules/tasks/projectors/raw-task-events.ts)
- [task-agent-runner.ts](../apps/service/src/modules/tasks/integrations/task-agent-runner.ts)

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

raw event 的数据库序号与对外 `TaskAgentEvent.sequence` 不是同一套编号。

原因：

- 一个 raw event 可能投影成多条 normalized event
- 为了保持前端 cursor 是单调整数，query projection 使用 stride 方案生成 projected sequence

因此：

- `/events` 的 `afterSequence` 必须传上一次响应中的 projected `nextSequence`
- 不应将 projected sequence 直接当作数据库 raw sequence 使用

## 4. Service 层接口

来源：

- [task.service.ts](../apps/service/src/modules/tasks/services/task.service.ts)

### 4.1 `createTaskAndRun(input)`

```ts
function createTaskAndRun(input: {
  projectId: string
  input: AgentInputItem[]
  model?: string | null
  agentType?: string
  executionMode?: string | null
}): Promise<CodexTask>
```

行为：

- `projectId.trim()` 为空时抛 `INVALID_PROJECT_ID`
- `input` 为空或无法生成 display prompt 时抛 `INVALID_PROMPT`
- 若项目不存在，抛 `PROJECT_NOT_FOUND`
- `agentType` 支持别名归一化：
  - `claude`
  - `claudcode`
  - `claudecode`
  - 都会归一化到 `claude-code`
- 会校验 model 是否属于当前 executor 可用模型集合
- 若 project 开启 Harbor skills 且 executor 不是 `codex`，会注入 bootstrap prompt 与 skill access 目录
- 后端会在执行前根据 `executionMode` 计算最终 `RuntimePolicy`
- 创建成功后立即进入执行流程

补充说明：

- 纯图片输入是允许的，display prompt 会退化为 `Shared 1 image` 或 `Shared N images`

### 4.2 `followupTask(input)`

```ts
function followupTask(input: {
  taskId: string
  input: AgentInputItem[]
  model?: string | null
  modelSource?: "task-default" | "runtime-default"
  executionMode?: RuntimeExecutionMode | null
}): Promise<CodexTask>
```

约束：

- 原 task 必须存在
- 原 task 必须已有 `threadId`
- 原 task 必须是 terminal 状态
- 原 task 不能已归档
- 同一 thread 中不能已有其他 active task

model 选择规则：

- 如果显式传 `model`，优先使用该值
- 如果 `modelSource === "runtime-default"`，则不强制继承 task.model
- 否则优先用 task 自身 model，没有时再回退 executor 默认模型

### 4.3 `retryTask(input)`

```ts
function retryTask(input: {
  taskId: string
}): Promise<CodexTask>
```

行为：

- 仅允许 `failed` 或 `cancelled` task 重试
- 已归档 task 不允许重试
- 若 task 有 `threadId`，优先走 follow-up 续跑
- 若 task 没有 `threadId`，则创建新的 child task 并重跑

### 4.4 `breakTaskTurn(input)`

```ts
function breakTaskTurn(input: {
  taskId: string
  reason?: string
}): Promise<CodexTask>
```

行为：

- 仅允许 `running` task 调用
- 已归档 task 不允许 break
- 成功后通常会将 task 收敛到 `cancelled`

### 4.5 `updateTaskTitle(input)`

```ts
function updateTaskTitle(input: {
  taskId: string
  title: string
  source?: "agent" | "user"
}): Promise<CodexTask>
```

行为：

- `taskId` 为空时报 `INVALID_TASK_ID`
- `title.trim()` 为空时报 `INVALID_TASK_TITLE`
- 默认 `source = "agent"`

### 4.6 `archiveTask(input)`

```ts
function archiveTask(input: {
  taskId: string
}): Promise<CodexTask>
```

行为：

- 仅允许 terminal task 归档
- 已归档 task 再次归档时直接返回当前 task

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
function getTaskDetail(taskId: string): Promise<CodexTask>
```

行为：

- 空 taskId 抛 `INVALID_TASK_ID`
- 不存在抛 `TASK_NOT_FOUND`

### 4.9 `listProjectTasks(input)`

```ts
function listProjectTasks(input: {
  projectId: string
  limit?: number
  includeArchived?: boolean
}): Promise<CodexTask[]>
```

行为：

- 会先验证 project 是否存在
- `includeArchived !== true` 时排除已归档 task

### 4.10 `getTaskEvents(input)`

```ts
function getTaskEvents(input: {
  taskId: string
  afterSequence?: number
  limit?: number
}): Promise<{
  task: CodexTask
  events: TaskAgentEventStream
  isTerminal: boolean
}>
```

行为：

- 先读取 task detail
- 将 projected `afterSequence` 转换为 raw lower-bound cursor
- repository 读取 raw events
- service 再做 raw -> normalized projection

注意：

- repository 返回的并不是最终对外事件流
- service 层才是 `/events` 的语义边界

## 5. HTTP API

来源：

- [tasks.routes.ts](../apps/service/src/modules/tasks/routes/tasks.routes.ts)
- [tasks.schema.ts](../apps/service/src/modules/tasks/schemas/tasks.schema.ts)

以下路径均以 `/v1` 为前缀。

### 5.1 `POST /v1/tasks`

请求体：

```json
{
  "projectId": "project-id",
  "input": [
    { "type": "text", "text": "Run tests" },
    { "type": "local_image", "path": ".harbor/task-input-images/example.png" }
  ],
  "model": "gpt-5",
  "executor": "codex",
  "executionMode": "connected"
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
- `400 INVALID_PROJECT_ID`
- `400 INVALID_PROMPT`
- `400 INVALID_TASK_MODEL`
- `400 UNSUPPORTED_EXECUTOR`
- `404 PROJECT_NOT_FOUND`
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

### 5.4 `POST /v1/tasks/:taskId/followup`

请求体：

```json
{
  "input": [
    { "type": "text", "text": "Continue with the refactor" }
  ],
  "model": "gpt-5",
  "modelSource": "task-default"
}
```

常见错误：

- `400 INVALID_REQUEST_BODY`
- `400 INVALID_PROMPT`
- `404 TASK_NOT_FOUND`
- `409 INVALID_TASK_FOLLOWUP_STATE`
- `500 TASK_FOLLOWUP_FAILED`

### 5.5 `POST /v1/tasks/:taskId/retry`

成功响应：

```json
{
  "ok": true,
  "task": { "...": "CodexTask" }
}
```

常见错误：

- `404 TASK_NOT_FOUND`
- `409 INVALID_TASK_RETRY_STATE`
- `500 TASK_RETRY_FAILED`

### 5.6 `POST /v1/tasks/:taskId/break`

请求体：

```json
{
  "reason": "optional"
}
```

常见错误：

- `404 TASK_NOT_FOUND`
- `409 INVALID_TASK_BREAK_STATE`
- `500 TASK_BREAK_FAILED`

### 5.7 `PUT /v1/tasks/:taskId/title`

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
  "projectId": "project-id"
}
```

常见错误：

- `404 TASK_NOT_FOUND`
- `409 INVALID_TASK_DELETE_STATE`
- `500 TASK_DELETE_FAILED`

### 5.10 `GET /v1/projects/:projectId/tasks`

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
