# Task Break Requirements

## 1. 文档信息

- 文档名称：Task Break Requirements
- 日期：2026-03-29
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/task`
  - `apps/service/src/lib/agents`
  - `apps/web/src/modules/tasks`
- 关联文档：
  - [task-api.md](./task-api.md)
  - [frd-task-frontend.md](./frd-task-frontend.md)
  - [task-runtime-system-design-2026-03-23.md](./task-runtime-system-design-2026-03-23.md)
  - [task-event-storage-model.md](./task-event-storage-model.md)
  - [agent-event-projection-design-2026-03-25.md](./agent-event-projection-design-2026-03-25.md)
  - [service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
  - [tdd/task.md](./tdd/task.md)

## 2. 背景

当前 Harbor 在产品文档与实现层都还没有真正提供“中断当前 turn”的 task-facing 能力，但底层 runtime adapter 实际已经具备了可利用的中断基础。

现状有四个明显断点：

1. README 明确把 `break current turn` 列为当前不支持能力
2. `task` 模块当前没有 `POST /tasks/:taskId/cancel` 之类的 task-facing API
3. `TaskRuntimePort` 只有 `startTaskExecution` / `resumeTaskExecution`，没有 break/cancel 语义
4. Codex / Claude Code adapter 虽然已经支持 `AbortSignal`，但 service 的 execution driver 没有真正把 signal 贯通到 runtime

与此同时，当前系统又已经具备三个关键基础：

1. `Task` / `Execution` 状态模型里已经存在 `cancelled`
2. `resume` 语义已经清晰：在同一个 execution / session 上继续运行
3. agent adapter 已经能消费 `AbortSignal`，因此真正缺失的是 service orchestration，而不是 provider 能力

因此，本次改造的关键不是重新设计一套 session API，而是把“break 当前 turn”稳定收敛成一个 task-facing command，并保证它在 race、事件投影和前端交互上都能得到确定结果。

## 3. 目标

本需求文档只定义 task break 功能本轮必须实现的业务目标，不讨论更远期的多进程分布式取消、retry 重做或 thread fork 模型。

核心目标如下：

1. 为 `running` task 提供显式的 `break current turn` 能力
2. 提供 task-facing 的 `POST /v1/tasks/:taskId/cancel` API，而不是暴露通用 session API
3. 让 service 可以把 break 请求真正传递到底层 runtime adapter
4. 让用户发起的 break 最终稳定收敛到 `cancelled`
5. 避免 cancel / complete / fail 并发竞争导致 terminal state 被后写覆盖
6. 让事件流能够表达“用户请求 break”与“turn 已被取消”这两个业务事实
7. 保持当前 resume 语义不变：cancel 后仍可继续在同一个 task / execution 上 resume

## 4. 非目标

本次改造不尝试解决以下问题：

1. 不对前端公开通用 `/sessions/:id/cancel` API
2. 不在本轮引入新的 execution attempt / retry lineage 模型
3. 不在本轮解决多 service 实例之间共享 cancel handle 的问题
4. 不要求 service 重启后重新接管一个已经在外部运行的 provider turn
5. 不在本轮引入 `cancel_requested` 持久化状态字段作为中间态
6. 不重做整个 task composer 的视觉与信息架构

## 5. 核心业务判断

### 5.1 break 的业务语义判断

本次 `break current turn` 的语义是：

1. 用户对一个 `running` task 发起中断当前 turn 的请求
2. 系统尝试终止当前正在进行的 runtime 调用
3. 该操作不删除 task，不清空事件历史，也不创建新的 execution
4. 该操作本质上是 task-facing command，而不是 runtime 内部调试动作

因此，本次能力名称虽然可以在 UI 上继续叫 `break` 或 `stop current turn`，但 service canonical command 应统一收敛为 `cancel task execution`。

### 5.2 terminal 状态语义判断

本次改造完成后，用户主动发起且被系统接受的 break，请求的业务目标状态应为 `cancelled`，而不是 `failed`。

具体判断如下：

1. 用户主动 break 成功到达 runtime 时，最终状态应收敛到 `cancelled`
2. provider 因 abort 引发的异常，不应默认被映射为 `failed`
3. 只有当系统无法完成取消编排、且错误并非用户取消语义时，才进入 `failed`
4. `cancelled` 仍是 terminal 状态，但允许后续 `resume`

### 5.3 task-facing 入口判断

break 能力必须继续保持 task-centric，而不是把前端耦合到 runtime aggregate。

因此：

1. 对外 canonical API 应是 `POST /v1/tasks/:taskId/cancel`
2. route 层接收 `taskId`，而不是 `executionId` / `sessionId`
3. 是否存在 session、是否支持 provider-level abort，属于 task 模块内部编排细节

### 5.4 状态机与幂等性判断

本次 break 行为必须满足确定性的状态判断：

1. `running` task 可以被 cancel
2. `completed` / `failed` / `cancelled` task 再次 cancel 时，按幂等处理，直接返回当前 task
3. `archived` task 不接受 cancel
4. 处于非 `running` 且非 terminal 的 task，不允许进入 break 流程

### 5.5 cancel 与 complete/fail 的竞争判断

本次能力最重要的实现约束，是 cancel 不允许被后续 terminal 写入覆盖。

因此必须明确：

1. 所有 terminal transition 都必须通过统一的 compare-and-set 语义执行
2. 只有当前状态仍是 `running` 时，才能写入 `completed` / `failed` / `cancelled`
3. 谁先成功把状态从 `running` 改为 terminal，谁赢
4. 一旦 `cancelled` 已落库，后续 completion/failure 不得覆盖它

### 5.6 事件语义判断

break 不应只表现为“最后任务变成 cancelled”，而应在事件流中保留清晰的业务轨迹。

因此建议至少保留两类 Harbor synthetic 事件：

1. `harbor.cancel_requested`
2. `harbor.cancelled`

判断如下：

1. `harbor.cancel_requested` 表示 Harbor 已接收用户 break 请求
2. `harbor.cancelled` 表示 Harbor 已将本次 turn 收敛为取消结束
3. 前端不应依赖 provider-specific raw error 文本来推断“这是不是 break”

### 5.7 resume 语义判断

break 不改变当前系统“一个 task 对应一个 execution”的主语义。

因此：

1. cancel 不创建新的 task
2. cancel 不要求创建新的 execution
3. 若 provider/session 允许 resume，则 cancel 后仍在同一个 execution/session 上继续
4. 当前已有的 queued prompt 机制可以继续复用 terminal → auto resume 的逻辑，不必为 break 单独引入新的 next-turn 模型

## 6. 需求范围

### 6.1 后端 HTTP contract

#### FR-1 新增 cancel task API

后端必须提供：

```http
POST /v1/tasks/:taskId/cancel
```

请求体第一阶段可支持：

```json
{
  "reason": "User requested stop"
}
```

规则：

1. 请求体可为空
2. `reason` 为可选字符串
3. 若未传 `reason`，系统应使用稳定默认文案

#### FR-2 cancel 的响应语义

`POST /v1/tasks/:taskId/cancel` 的返回值应与其他 task command 保持一致，返回最新 task detail。

要求：

1. 对 `running` task 发起 cancel 时返回当前 task detail
2. 对 terminal task 发起 cancel 时按幂等返回当前 task detail
3. 对不存在 task 返回结构化 `404`
4. 对 archived task 返回结构化业务错误

#### FR-3 cancel 的状态约束

第一阶段只要求稳定支持 `running` task 的 break。

判断规则：

1. `running` → 允许 cancel
2. `completed` / `failed` / `cancelled` → 幂等返回
3. `archived` → 拒绝
4. 其他状态若未来出现，应明确拒绝，而不是静默接受

### 6.2 service runtime orchestration

#### FR-4 runtime port 必须暴露 cancel 语义

`TaskRuntimePort` 必须新增明确的 cancel/break command，例如：

```ts
cancelTaskExecution(input: { taskId: string; reason?: string | null }): Promise<void>
```

要求：

1. `task` application layer 不直接操作 adapter 或 `AbortController`
2. task-facing command 通过 runtime facade/port 完成编排
3. 命名应表达 task-facing 语义，而不是 provider-specific 动作

#### FR-5 service 必须持有 in-flight execution handle

为了让 break 请求真正到达 runtime，service 必须在任务运行期间维护 in-flight execution handle registry。

MVP 要求：

1. registry 至少能按 `taskId` 找到当前运行中的 `AbortController`
2. start/resume 开始时注册 handle
3. turn 结束后移除 handle
4. 同一个 task 同一时刻只允许一个 active handle

#### FR-6 execution driver 必须把 `AbortSignal` 传给 adapter

当前 driver 虽然调用了 adapter，但没有真正把 signal 贯通。

改造后必须保证：

1. `startSessionAndRun` 使用 service 创建的 `AbortSignal`
2. `resumeSessionAndRun` 使用 service 创建的 `AbortSignal`
3. cancel 时能够触发底层 Codex / Claude Code adapter 的 abort 路径

### 6.3 持久化与 lifecycle

#### FR-7 取消必须写入 `cancelled`

当 break 被成功接受并进入取消流程后，最终持久化结果必须支持：

1. `Execution.status = cancelled`
2. `Task.status = cancelled`
3. `finishedAt` 被正确写入
4. `sessionId` 不因 cancel 被清空

#### FR-8 终态写入必须具有 compare-and-set 语义

为避免 cancel 和自然完成同时发生造成状态漂移，状态存储层必须提供 terminal guard。

要求：

1. `completed` / `failed` / `cancelled` 都只能从 `running` 写入
2. terminal 更新失败时，不允许二次覆盖已有 terminal 状态
3. cancel 成功后，后续 completion/failure 只能被记录为日志或忽略，不能覆盖主状态

#### FR-9 runtime handle 缺失时必须有收敛策略

若 task 仍显示 `running`，但 service 已无法拿到对应 runtime handle，系统不能长期卡死在不可恢复的 running 态。

第一阶段推荐语义：

1. 若 cancel 请求到来时 handle 缺失，service 仍应把任务收敛到 terminal
2. 默认收敛到 `cancelled`
3. 同时写入可审计的 synthetic event / reason，说明本次是“forced convergence without runtime handle”

### 6.4 事件与 projection

#### FR-10 Harbor 必须写入 cancel synthetic event

break 能力必须在 execution event 中留下 Harbor 自身可解释的记录。

至少包括：

1. `harbor.cancel_requested`
2. `harbor.cancelled`

建议 payload：

```json
{
  "reason": "User requested stop",
  "requestedBy": "user",
  "timestamp": "2026-03-29T00:00:00.000Z"
}
```

#### FR-11 projection 必须提供 provider-agnostic 的 cancel 结果

对外 `/events` 仍返回 normalized 事件。

要求：

1. 前端能够从 normalized stream 中识别 break 请求与取消结束
2. projection 不应要求前端理解不同 provider 的 abort error 细节
3. 若 provider 自身产出 abort/error 事件，projection 也必须收敛到 Harbor 统一 cancel 语义

### 6.5 前端交互范围

#### FR-12 running task 必须出现 break 入口

当前前端已经存在 break button 形态定义，但尚未接入真实行为。

改造后至少要求：

1. `running` task 出现 break 按钮
2. 点击后调用 `POST /v1/tasks/:taskId/cancel`
3. cancel 请求进行中时，避免重复提交
4. 最终 UI 仍以 task detail / event stream 为准，而不是本地直接伪造 terminal 状态

#### FR-13 queued prompt 语义保持兼容

当前 running task 支持用户先排队下一条 prompt。

本次 break 改造不应破坏这条链路：

1. 如果没有 queued prompt，task 在 cancel 后停在 `cancelled`
2. 如果已有 queued prompt，前端可以继续沿用“running → terminal 后自动 resume”的既有机制
3. break 本身不负责创建 next turn，只负责尽快结束当前 turn

## 7. 数据与接口变更

### 7.1 接口变更

后端新增：

1. `POST /v1/tasks/:taskId/cancel`

后端内部变更：

1. `TaskRuntimePort` 新增 cancel command
2. current runtime facade 新增 cancel 编排
3. execution driver 新增 `AbortController` 与 registry 接入

前端新增：

1. task api client 新增 `cancelTask`
2. task session hook 新增 break mutation / action

### 7.2 数据模型变更

MVP 第一阶段不强制要求数据库 schema 变更。

原因：

1. 当前 `TaskStatus` / `ExecutionStatus` 已支持 `cancelled`
2. cancel 的运行时 source of truth 可先由 in-memory registry 承担
3. 事件记录已可通过 `ExecutionEvent` 承载

可选增强项，不属于第一阶段必做：

1. `Execution.cancelRequestedAt`
2. `Execution.cancelReason`

## 8. 验收标准

满足以下条件时，本需求才算完成：

1. `running` task 可通过显式 API 被 break
2. break 后 task/execution 稳定进入 `cancelled`
3. cancel 与自然完成并发时，最终状态不会被后写覆盖
4. `/events` 能表达 cancel request 与 cancelled 结果
5. cancel 后仍可继续对同一 task 执行 `resume`
6. terminal task 再次 cancel 时按幂等返回，不产生错误副作用
7. 前端运行中的 task 能触发 break，且不会因为 provider 差异需要额外判断 raw abort 文本

## 9. 实施建议顺序

推荐按以下顺序落地：

1. 先补 `cancel` 业务规则与应用层测试
2. 再接 runtime registry 与 `AbortSignal` 贯通
3. 再补 terminal guard，解决 cancel/complete race
4. 再补 synthetic cancel event 与 projection
5. 最后接 route、API client、hook 和 composer break 行为

这个顺序的目的只有一个：

先锁住任务状态与运行编排的确定性，再接 UI，不要反过来先把 stop 按钮点亮，再回头补 terminal race。
