# Task Effort Requirements

> [!WARNING]
> **状态：Partially Superseded**
> 本文档中的 `POST /v1/tasks` 示例保留了 orchestration 引入前的 create API 表达。
> 当前 create task 的 canonical contract 已迁移到 `POST /v1/orchestrations/:orchestrationId/tasks`。
> `effort` 语义本身仍有效，但接口路径请以最新 task/orchestration 文档为准。

## 1. 文档信息

- 文档名称：Task Effort Requirements
- 日期：2026-03-29
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/task`
  - `apps/service/src/lib/agents`
  - `apps/service/prisma`
  - `apps/web/src/modules/tasks`
- 关联文档：
  - [task-api.md](./task-api.md)
  - [frd-task-frontend.md](./frd-task-frontend.md)
  - [task-runtime-system-design-2026-03-23.md](./task-runtime-system-design-2026-03-23.md)
  - [service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
  - [tdd/task.md](./tdd/task.md)

## 2. 背景

当前 Harbor 在 agent capability 与底层 runtime adapter 两端，实际上已经具备 `effort` 相关能力，但 `task create` 业务链路还没有把它真正暴露出来。

现状存在四个明显断点：

1. `/v1/agents/capabilities` 已经会返回每个 model 支持的 `efforts`
2. `AgentRuntimeOptions` 已经定义了 `effort?: RuntimeReasoningEffort`
3. Codex / Claude Code adapter 已经能把 `effort` 映射到底层 SDK
4. 但 `POST /v1/tasks` 还不接受 `effort`，也不会把它持久化到 task runtime snapshot

这导致三个直接问题：

1. 前端虽然能知道某个 model 支持哪些 effort，但无法在 create 时真正提交
2. task detail / task list 无法回显用户本次运行选择的 effort
3. 即便底层 runtime 支持 effort，task create / resume 仍无法稳定复用同一份运行配置

因此，这次改造的关键不是引入新的 provider 能力，而是把现有 `effort` 能力稳定接入 task create 的业务边界、持久化边界和 runtime 边界。

## 3. 目标

本需求文档只定义本轮 effort 接入必须实现的业务目标，不讨论更远期的 project-level execution preset 演进。

核心目标如下：

1. `POST /v1/tasks` 支持显式传入 `effort`
2. create 成功后，task 读模型能够稳定回显 `effort`
3. task runtime 真正收到 create 请求指定的 `effort`
4. resume 不允许悄悄丢失 create 时选定的 `effort`
5. 前后端共享同一套 Harbor 归一化 effort 语义
6. 未传 `effort` 的旧调用链路继续兼容

## 4. 非目标

本次改造不尝试解决以下问题：

1. 不在本轮引入 project settings 的 `defaultEffort`
2. 不支持 provider-specific 的原生 effort 字符串直接透传到 task API
3. 不在本轮允许 `resume` 覆盖已创建 task 的 `effort`
4. 不重做 `/v1/agents/capabilities` 的整体结构
5. 不追求补齐历史旧 task 的 effort 数据回填

## 5. 核心业务判断

### 5.1 effort 的业务语义判断

本次 `effort` 表示 Harbor 归一化后的 reasoning effort，而不是 provider 原生参数。

对外协议采用 Harbor 统一枚举：

```ts
type TaskEffort = "minimal" | "low" | "medium" | "high" | "xhigh"
```

业务判断如下：

1. `effort` 是 task create 的可选运行参数
2. 不传 `effort` 表示“不显式指定”，由 provider 使用其默认行为
3. `none` 不进入 create API，因为“未指定”已经由缺省语义表达
4. provider-specific 映射只发生在 adapter 层，不进入 task API contract

### 5.2 source of truth 判断

本次改造完成后，必须明确：

1. `Execution` 上持久化的 effort 字段是运行配置的 source of truth
2. task detail / list 中展示的 `effort` 是 execution snapshot 的投影
3. runtime resume 使用 execution snapshot 中的 `effort`，而不是重新猜测

### 5.3 校验语义判断

`effort` 不是任意字符串，必须满足 Harbor capability catalog 的约束。

因此 create 时必须遵守以下规则：

1. 若 `effort` 缺失或为 `null`，按“未指定”处理
2. 若 `effort` 存在，必须属于 Harbor 统一 effort 枚举
3. 若 `model` 已解析为具体 model，则 `effort` 必须存在于该 model 的 `efforts` 列表中
4. 若 `model` 未指定，则系统可按当前 executor 的默认 model 能力做校验；若无法可靠判断，则必须返回结构化错误，而不是静默接受非法组合

### 5.4 create / resume 关系判断

本轮 effort 的写入入口只在 create。

理由：

1. 当前 `resume` 语义是继续已有 execution，而不是创建一份新的 runtime config
2. 若允许 `resume` 修改 effort，会让一次 task 的 execution snapshot 出现漂移
3. 先把 create → persist → resume reuse 这条主链路锁稳，比同时开放修改更重要

因此：

1. `create` 可设置 `effort`
2. `resume` 不接收新的 `effort`
3. `resume` 必须沿用 create 时持久化的 `effort`

## 6. 需求范围

### 6.1 后端 HTTP contract

#### FR-1 create 支持可选 `effort`

`POST /v1/tasks` 必须支持以下新增字段：

```json
{
  "effort": "medium"
}
```

字段语义：

1. `effort` 可缺省
2. `effort` 可为 `null`
3. `effort` 存在时必须为 Harbor 统一 effort 枚举之一

兼容规则：

1. 旧客户端不传 `effort` 时，create 行为保持不变
2. 旧客户端仍可只传 `prompt/items + executor/model/executionMode`
3. 新客户端可在 create 时附带 `effort`

#### FR-2 create 错误必须结构化

当 `effort` 非法或不受支持时，create 必须返回结构化业务错误，而不是隐式降级。

必须覆盖的错误场景：

1. `effort` 不是合法枚举值
2. `effort` 不被当前 model 支持
3. `effort` 与当前 executor / model 组合无法可靠解析

禁止行为：

1. 非法 `effort` 被 silently ignored
2. 不支持的 `effort` 被自动改成 provider 默认值
3. 同一个请求在 detail 里看不到真实最终生效的 effort

### 6.2 任务运行配置

#### FR-3 task runtime config 必须持有 `effort`

`task` 模块内部的 runtime config 必须扩展出 `effort` 字段，并沿 create 全链路透传。

至少包括以下边界：

1. create route body
2. create use case input
3. `TaskRuntimeConfig`
4. runtime policy / runtime options builder
5. runtime driver 启动参数

禁止行为：

1. `effort` 只在 route 里出现，但进入 use case 后丢失
2. `effort` 落到 read model，但没有传给 runtime
3. runtime 收到的 effort 来自临时拼接字符串，而不是结构化 config

#### FR-4 adapter 层负责 provider 映射

Harbor 的统一 effort 值必须在 adapter 层映射成 provider 需要的参数。

语义要求：

1. Codex adapter 继续直接消费 Harbor effort 值
2. Claude Code adapter 继续负责把 `xhigh` 等 Harbor 值映射为 provider 所需枚举
3. task 模块不关心 provider-specific effort 文案

### 6.3 持久化与读模型

#### FR-5 execution 必须持久化 effort

`Execution` 持久化模型必须新增 effort 字段，用于保存 create 时最终确定的 effort snapshot。

要求：

1. 字段允许为 `null`
2. create 时如果指定了 `effort`，必须写入 execution
3. 未指定 `effort` 时，持久化为 `null`
4. resume 不得覆盖该字段

推荐命名：

1. DB 层使用 `executorEffort`
2. 业务 / API 层继续使用 `effort`

#### FR-6 task detail / task list 必须回显 effort

task 读模型必须把 effort 作为 runtime snapshot 的一部分暴露出去。

至少覆盖：

1. `TaskRuntimeSnapshot`
2. `TaskRecord`
3. `TaskListItem`
4. `TaskDetail`
5. task interaction record

回显规则：

1. 若 create 显式指定了 `effort`，detail / list 返回相同值
2. 若未指定，detail / list 返回 `null`
3. 任何读接口都不得伪造 provider 默认 effort

### 6.4 resume 语义

#### FR-7 resume 复用 persisted effort

`POST /v1/tasks/:taskId/resume` 在恢复 execution 时，必须复用 execution snapshot 中已持久化的 `effort`。

要求：

1. resume route body 本轮不新增 `effort`
2. current task runtime facade 读取 execution 时，要把 persisted effort 一起带回 runtime config
3. provider resume 时接收到的 effort 与 create 时一致

### 6.5 前端 contract

#### FR-8 frontend create payload 支持 `effort`

task create client 必须能够发送 `effort`，并与 create dialog 的选择保持一致。

要求：

1. `CreateTaskInput` 扩展 `effort?: TaskEffort | null`
2. create dialog 基于 agent capabilities 中的 `models[].efforts` 提供候选项
3. 未选择 effort 时，前端不强行填充默认值

#### FR-9 frontend 展示 effort snapshot

task list / task detail 至少需要拿到 effort 字段，供后续 UI 展示与调试使用。

本轮不强制定义最终视觉样式，但 contract 必须先齐。

## 7. 数据与接口变更

### 7.1 API contract 变更

`POST /v1/tasks` 请求新增：

```ts
type CreateTaskBody = {
  projectId: string
  prompt?: string
  items?: AgentInputItem[]
  title?: string
  executor?: string | null
  model?: string | null
  executionMode?: string | null
  effort?: TaskEffort | null
}
```

task read model 返回新增：

```ts
type TaskRuntimeSnapshot = {
  executor: string | null
  model: string | null
  executionMode: string | null
  effort: TaskEffort | null
}
```

### 7.2 数据库变更

`Execution` 模型新增可空字段：

```prisma
executorEffort String?
```

约束要求：

1. 对历史数据兼容
2. migration 不要求回填旧任务
3. 新建 task 后，execution snapshot 可稳定保留 effort

## 8. 验收标准

当以下条件全部满足时，本次 effort 需求才算完成：

1. `POST /v1/tasks` 能接受并校验 `effort`
2. create 成功后，task detail / list / interaction record 可回显 `effort`
3. `Execution` 已持久化 effort snapshot
4. runtime start / resume 都能使用同一份 persisted effort
5. 非法或不支持的 effort 组合会返回结构化错误
6. 不传 `effort` 的旧 create 调用保持兼容

## 9. 实施建议顺序

建议按以下顺序推进，而不是同时散改所有层：

1. 先补 capability-aware effort helper 与 use case 测试
2. 再扩 `TaskRuntimeConfig` 与 execution persistence
3. 再补 route schema / API client contract
4. 最后接 create dialog 选择与回显

这样做的原因是：

1. 最容易返工的是 effort 的语义与校验，不是 UI 下拉框
2. effort 一旦进入 execution snapshot，resume 语义才能稳定
3. 先锁住 create → persist → runtime 这条主链路，前端集成成本最低
