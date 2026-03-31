# Task Resume Runtime Overrides Requirements

## 1. 文档信息

- 文档名称：Task Resume Runtime Overrides Requirements
- 日期：2026-03-30
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/task`
  - `apps/service/src/modules/task/infrastructure/runtime`
  - `apps/service/src/lib/agents`
  - `apps/web/src/modules/tasks`
  - `apps/web/src/stores`
- 关联文档：
  - [task-api.md](./task-api.md)
  - [task-effort-requirements-2026-03-29.md](./task-effort-requirements-2026-03-29.md)
  - [task-structured-input-requirements-2026-03-28.md](./task-structured-input-requirements-2026-03-28.md)
  - [task-runtime-system-design-2026-03-23.md](./task-runtime-system-design-2026-03-23.md)
  - [agent-runtime-integration.md](./agent-runtime-integration.md)
  - [tdd/task-effort.md](./tdd/task-effort.md)
  - [tdd/task.md](./tdd/task.md)

## 2. 背景

当前 Harbor 已支持：

1. create task 时选择 `executor` / `model` / `effort`
2. resume task 时继续同一个 task / execution / provider session
3. Codex 与 Claude Code runtime adapter 在底层 resume 调用时继续接收完整 runtime options

但 task-facing 的 resume 能力仍有一个明显缺口：

1. 前端 resume composer 只能输入新的 prompt / structured input
2. 前端 resume UI 只展示当前 executor / executionMode / model，不支持修改
3. `POST /v1/tasks/:taskId/resume` 的 HTTP contract 只接受 `prompt` / `items`
4. `resumeTaskUseCase` 与 `TaskRuntimePort.resumeTaskExecution` 不接受 runtime override
5. service 在 resume 时总是复用 execution record 上已经持久化的 `model` / `effort`

这会造成一个直接的产品问题：

1. 用户在第一次 task run 后，可能发现当前 model 不适合继续该任务
2. 用户可能需要在同一条 task 上提高或降低 `effort`
3. 这些都属于“继续同一个任务上下文，但调整当前 runtime 策略”的正常需求
4. 现状却迫使用户只能继续沿用旧配置，或新建另一条 task

与此同时，底层 provider 适配层已经具备关键能力：

1. Codex resume 调用支持 thread options，并可携带 `model` 与 `modelReasoningEffort`
2. Claude Code resume 调用支持 query options，并可携带 `model` 与 `effort`
3. Harbor 的 `IAgentRuntime.resumeSessionAndRun` 也已经定义为接收完整 `AgentRuntimeOptions`

因此，本次改造的关键不是扩 provider 能力，而是把“resume 时可覆盖 model / effort”的需求稳定收敛成 task-facing product capability，并让 HTTP contract、应用层、持久化语义、runtime 调度与前端交互保持一致。

## 3. 目标

本需求文档只定义本轮必须实现的业务目标，不讨论更远期的 task fork、execution lineage 或跨 provider thread migration。

核心目标如下：

1. 为 `resume` 提供 task-facing 的 `model` / `effort` 覆盖能力
2. 保持 `resume` 继续同一个 task / execution / provider session 的语义不变
3. 让用户在同一条 task 上，针对后续 turn 调整 `model` / `effort`
4. 让 service 在 resume 时真正把覆盖后的 runtime config 传到底层 adapter
5. 让 task detail / task list 在 resume 成功后回显最新 runtime snapshot
6. 对非法的 model / effort 组合提供明确拒绝，而不是 silent fallback
7. 让前端 resume composer 与 create composer 的配置能力在业务语义上对齐

## 4. 非目标

本次改造不尝试解决以下问题：

1. 不支持在 resume 时切换 `executor`
2. 不支持在本轮引入新的 execution attempt / fork / branch 模型
3. 不要求把一条 Codex session 迁移到 Claude Code，或反向迁移
4. 不要求在本轮开放 executionMode override
5. 不在本轮重做完整的 task session 信息架构与视觉设计
6. 不要求补做 provider-level 历史 turn rewrite / retroactive replay
7. 不要求修改已完成历史 turn 的 runtime snapshot

## 5. 核心业务判断

### 5.1 resume override 的业务语义判断

本次需求中的 resume runtime override 语义是：

1. 用户继续同一条 task
2. 用户继续同一个 execution / session
3. 用户只调整后续 turn 的 runtime 配置
4. 当前 turn 之前已经完成的历史输出不受影响

因此，这不是“创建新 task”，也不是“fork session”，而是“在当前 session 的后续输入边界上覆盖 runtime config”。

### 5.2 executor 不可切换判断

本轮不支持在 resume 时切换 executor。

理由：

1. provider session 本身与 executor 类型绑定
2. 当前 runtime registry 与 execution persistence 都以单 executor session 为基础
3. 允许 executor 切换会把需求从“resume override”扩大成“cross-provider session migration”
4. 这会显著改变 `resume` 的 canonical semantics

因此：

1. `resume` 允许覆盖 `model`
2. `resume` 允许覆盖 `effort`
3. `resume` 不允许覆盖 `executor`

### 5.3 persisted runtime snapshot 判断

本次改造完成后，task read model 中的 `model` / `effort` 应继续表示“当前 task 最新一次已接受的 runtime snapshot”，而不是“task 创建时的永久初值”。

因此：

1. create 成功后，task detail / list 回显 create 时的 snapshot
2. resume 成功并带 runtime override 后，task detail / list 回显新的 snapshot
3. 未提供 override 的 resume，继续回显已有 snapshot
4. 历史 turn 的原始上下文不被 retroactively 修改

### 5.4 覆盖语义判断

resume API 对 `model` / `effort` 的字段语义必须区分“省略”和“显式清空”。

规范如下：

1. 字段省略：表示沿用当前 execution snapshot
2. `model: null`：表示清除显式 model override，恢复 provider / runtime default model
3. `effort: null`：表示清除显式 effort override，恢复 provider default effort
4. `model: "..."`：表示使用新的 model
5. `effort: "..."`：表示使用新的 effort

因此，route / application / runtime 边界都必须保留字段 presence 语义，而不能把“未传”和“传了 null”混为一谈。

### 5.5 capability-aware 校验判断

resume override 必须继续沿用 create effort 的 capability-aware 校验原则。

具体要求：

1. 新的 model 若非空，必须属于当前 executor 的 capability catalog
2. 新的 effort 若非空，必须被“生效中的 model”支持
3. 若请求中未传 model，但传了 effort，则要基于“当前 snapshot 中的 model，或 provider default model”做 effort 校验
4. 若当前 executor 无法解析对应 capability catalog，则请求必须被拒绝，而不是静默透传

### 5.6 resume 运行前校验判断

所有 runtime override 的合法性校验必须在真正调用 provider runtime 之前完成。

因此：

1. 非法 model 组合在应用层直接失败
2. 非法 effort 组合在应用层直接失败
3. 不允许先更新 execution snapshot，再因为 provider 明显不支持而回滚
4. 只有通过校验的 override 才允许进入 runtime 调度

## 6. 需求范围

### 6.1 后端 HTTP contract

#### FR-1 resume API 支持 runtime overrides

`POST /v1/tasks/:taskId/resume` 必须在现有 `prompt` / `items` 之外，新增可选字段：

1. `model?: string | null`
2. `effort?: TaskEffort | null`

兼容规则：

1. 纯文本 resume 继续可用
2. structured input resume 继续可用
3. 未传 `model` / `effort` 时，行为与当前实现兼容

#### FR-2 resume API 不支持 executor override

`POST /v1/tasks/:taskId/resume` 不得接受 `executor` 字段。

理由：

1. executor 不是本轮业务范围
2. 如果请求中传入 executor，应返回结构化 validation error

### 6.2 应用层与领域编排

#### FR-3 resume command 支持 runtime override 输入

`resumeTaskUseCase` 必须接收 `model` / `effort` 的显式 override 输入，并在业务校验成功后生成“本次 resume 的最终 runtime config”。

最终 runtime config 解析规则如下：

1. `executor` 固定取当前 execution snapshot 的 executor
2. `model`：
   - 若请求显式传值，则取请求值
   - 若请求显式传 `null`，则取 `null`
   - 若请求省略，则沿用 persisted snapshot
3. `effort`：
   - 若请求显式传值，则取请求值
   - 若请求显式传 `null`，则取 `null`
   - 若请求省略，则沿用 persisted snapshot

#### FR-4 resume override 必须通过 capability-aware 校验

应用层必须对解析后的最终 runtime config 做校验：

1. model 对当前 executor 合法
2. effort 对最终生效 model 合法
3. provider default 解析路径必须与 create 语义一致
4. 非法请求必须返回结构化 task error

### 6.3 运行时编排与 provider adapter

#### FR-5 runtime port 必须接受 resume runtime config

`TaskRuntimePort.resumeTaskExecution` 必须新增 `runtimeConfig` 输入，且该配置必须来自应用层校验后的最终 snapshot，而不是在 runtime facade 内部自行从 execution record 复原。

#### FR-6 execution driver 必须把 override 真正传到底层 adapter

service 在 resume 时必须把新的 `model` / `effort` 传给当前 executor 的 adapter。

具体要求：

1. Codex resume 必须使用新的 thread options
2. Claude Code resume 必须使用新的 query options
3. 若 override 为空，则 adapter 继续收到当前 snapshot 对应配置
4. 不允许 resume 时无条件忽略新的 runtimeConfig

### 6.4 持久化与读模型

#### FR-7 resume 成功后更新 execution runtime snapshot

一旦 resume command 通过业务校验并进入调度，系统必须把新的 runtime snapshot 写回当前 execution record。

持久化字段包括：

1. `executorModel`
2. `executorEffort`

约束如下：

1. `executorType` 在本轮保持不变
2. `executionMode` 在本轮保持不变
3. snapshot 的更新语义是“最新 accepted resume config”

#### FR-8 task detail / list 必须回显最新 snapshot

成功 resume 后，task detail 与 task list 中的：

1. `model`
2. `effort`

都必须回显最新 accepted snapshot。

### 6.5 前端交互

#### FR-9 resume composer 支持切换 model / effort

任务会话页的 resume composer 必须允许用户在 resume 前选择：

1. model
2. effort

其能力要求与 create composer 一致：

1. 基于 agent capabilities 渲染 model options
2. 基于当前生效 model 渲染 effort options
3. 切换 model 时自动校正 effort
4. 无效组合不得提交

#### FR-10 resume composer 必须回显当前 snapshot

当用户进入 task session 时，resume composer 的默认显示值应来自当前 task detail 的 runtime snapshot，而不是来自 create defaults store。

即：

1. 默认 executor 不可编辑，但可展示
2. 默认 model 取 task detail 当前 model
3. 默认 effort 取 task detail 当前 effort
4. 若 task 当前 model 为 `null`，UI 应展示 `Runtime Default`
5. 若 task 当前 effort 为 `null`，UI 应展示 `Provider Default`

#### FR-11 用户偏好不覆盖 task snapshot

`taskCreationDefaults` 或任何 create-time 用户偏好，不得直接覆盖 resume composer 的初始值。

原因：

1. resume 的 source of truth 是当前 task snapshot
2. create defaults 只适用于新建任务，不适用于已有 task 的继续执行

### 6.6 错误与兼容性

#### FR-12 非法 override 必须有结构化错误

以下情况必须返回结构化错误，而不是 silent fallback：

1. model 不存在于当前 executor capability 列表
2. effort 不被当前生效 model 支持
3. 当前 executor 不支持 resume
4. archived task 尝试 resume
5. 非 terminal / non-running 状态尝试发起不合法 resume

#### FR-13 省略字段时必须保持向后兼容

旧客户端若只发送：

1. `prompt`
2. `items`

则行为必须与当前实现保持一致。

## 7. 数据与契约变更

### 7.1 Web API contract

需要新增 / 调整：

1. `ResumeTaskInput` 支持 `model?: string | null`
2. `ResumeTaskInput` 支持 `effort?: TaskEffort | null`
3. task API client 在 resume body 中序列化这两个字段

### 7.2 Service route schema

需要新增 / 调整：

1. `ResumeTaskBody` 增加 `model?: string | null`
2. `ResumeTaskBody` 增加 `effort?: TaskEffort | null`
3. route schema 明确不接受额外 `executor` 字段

### 7.3 Runtime port contract

需要新增 / 调整：

1. `TaskRuntimePort.resumeTaskExecution(input)` 增加 `runtimeConfig`
2. `resumeTaskUseCase` 不再把 runtimeConfig 解析责任下沉到 facade

## 8. 验收标准

以下条件全部满足时，本需求才算完成：

1. 用户可以在 task session 的 resume composer 中切换 model
2. 用户可以在 task session 的 resume composer 中切换 effort
3. resume 请求会把新的 model / effort 发送到 service
4. service 会在 resume 前完成 capability-aware 校验
5. 合法 override 会真正进入 Codex / Claude Code adapter
6. resume 成功后 task detail / list 能回显新的 model / effort
7. 未传 override 的旧客户端仍可正常 resume
8. 非法 override 会得到明确结构化错误

## 9. 开放问题

本轮先明确不做，但需要在后续设计中继续观察的问题包括：

1. 是否要在 UI 上同时开放 executionMode override
2. 是否要为 resume runtime override 单独增加审计事件
3. 是否要把“当前 task snapshot”与“create defaults”在信息架构上进一步明确区分
4. 若 provider 对 session resume + model reset 的行为存在特殊限制，是否需要 provider-specific guardrail
