# Task Runtime Requirements

## 1. 文档信息

- 文档名称：Task Runtime Requirements
- 日期：2026-04-10
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/task`
  - `apps/service/src/lib/agents`
  - `apps/web/src/modules/tasks`
  - task create / resume / cancel 的 task-facing product contract
- 关联文档：
  - [./product-prd-2026-04-10.md](./product-prd-2026-04-10.md)
  - [./orchestration-requirements-2026-03-31.md](./orchestration-requirements-2026-03-31.md)
  - [./task-api.md](./task-api.md)
  - [./task-event-storage-model.md](./task-event-storage-model.md)
  - [./service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
  - [./agent-event-projection-design-2026-03-25.md](./agent-event-projection-design-2026-03-25.md)
  - [./agent-runtime-integration.md](./agent-runtime-integration.md)
  - [./frd-chat-frontend.md](./frd-chat-frontend.md)
  - [./tdd/orchestration.md](./tdd/orchestration.md)

## 2. 文档目标

本文档合并当前 task 运行链路上的五类专项需求：

1. 结构化输入
2. 显式 runtime config
3. resume runtime override
4. break / cancel
5. output schema

目标只有两个：

1. 为当前 `Task` 提供一份统一、可直接执行的需求基线
2. 避免同一条 task runtime 主线继续散落在多份局部文档中

## 3. 产品上下文

Harbor 当前主链路为：

```text
Workspace -> Project -> Orchestration -> Task
```

在这条主链路里：

1. `Orchestration` 是工作容器
2. `Task` 是用户直接交互的执行单元
3. create task 的 canonical contract 为 `POST /v1/orchestrations/:orchestrationId/tasks`
4. resume / cancel / archive / delete 仍保持 task 维度

本文档只定义 task-facing 需求，不重新定义 orchestration 的产品模型。

## 4. 本轮必须覆盖的能力

### 4.1 Create

1. 通过 `POST /v1/orchestrations/:orchestrationId/tasks` 创建 task
2. create 必须显式传入完整 runtime config
3. create 必须支持文本或结构化输入
4. create 可选接受本轮 `outputSchema`

### 4.2 Resume

1. 通过 `POST /v1/tasks/:taskId/resume` 继续同一条 task
2. resume 必须支持与 create 一致的输入表达能力
3. resume 允许覆盖后续 turn 的 `model` / `effort`
4. resume 不允许切换 `executor`
5. resume 可选接受本轮 `outputSchema`

### 4.3 Cancel

1. 通过 `POST /v1/tasks/:taskId/cancel` 中断当前运行中的 turn
2. cancel 的目标状态是 `cancelled`
3. cancel 后仍允许在同一条 task 上 resume

## 5. 统一业务判断

### 5.1 task-facing 语义优先

所有运行能力都应先被表达为 task-facing 行为，而不是把前端暴露到 provider session、execution attempt 或底层 runtime 调试概念。

因此：

1. 对外主入口始终围绕 `taskId`
2. session / execution / provider thread 只作为内部实现细节存在
3. 用户看到的是 task 的当前运行快照，而不是底层 attempt 图谱

### 5.2 create snapshot 必须明确

task 从创建成功开始就必须持有明确 runtime snapshot：

1. `executor`
2. `model`
3. `effort`
4. `executionMode`

后端不再承担 project-level fallback 或硬编码默认补全职责。

### 5.3 resume override 是后续 turn 覆盖

resume override 的语义是：

1. 继续同一条 task
2. 继续同一 provider session 语义
3. 只覆盖后续 turn 的 runtime 选择
4. 不 retroactively 修改历史 turn

### 5.4 `outputSchema` 是 turn 级指令

`outputSchema` 不属于长期 runtime config，它只描述当前一次 create 或 resume 请求希望得到的结构化输出约束。

因此：

1. `outputSchema` 不并入 task 的永久默认配置
2. `outputSchema` 不改变 task 的长期身份
3. `outputSchema` 只影响当前 turn

### 5.5 用户输入与事件存储的 source of truth

必须明确：

1. 原始输入与原始输出以事件存储为准
2. `Task.prompt` 只承担摘要职责
3. Harbor 必须主动落一条 user input event，而不是依赖 provider 回传

## 6. Canonical Contract

### 6.1 Create Task

路径：

```text
POST /v1/orchestrations/:orchestrationId/tasks
```

create 必须满足：

1. 输入内容至少提供 `prompt` 或 `items` 之一
2. runtime config 必须完整提供：
   - `executor`
   - `model`
   - `effort`
   - `executionMode`
3. 可选提供：
   - `title`
   - `outputSchema`

### 6.2 Resume Task

路径：

```text
POST /v1/tasks/:taskId/resume
```

resume 必须满足：

1. 输入内容至少提供 `prompt` 或 `items` 之一
2. 可选覆盖：
   - `model`
   - `effort`
   - `outputSchema`
3. 不允许覆盖：
   - `executor`
4. 当前 turn 不传 override 时，沿用 task 当前 snapshot

### 6.3 Cancel Task

路径：

```text
POST /v1/tasks/:taskId/cancel
```

cancel 必须满足：

1. 只面向 task 提供，不暴露通用 session cancel API
2. `running` task 可 cancel
3. terminal task 再次 cancel 按幂等处理
4. `archived` task 不接受 cancel

## 7. 输入模型

### 7.1 AgentInput

task 输入统一复用：

```ts
type AgentInput = string | AgentInputItem[]
```

其中：

```ts
type AgentInputItem =
  | { type: "text"; text: string }
  | { type: "local_image"; path: string }
```

### 7.2 结构化输入要求

1. create / resume 都必须支持 `prompt: string`
2. create / resume 都必须支持 `items: AgentInputItem[]`
3. 若两者都为空或无效，请求被拒绝
4. runtime 边界必须消费真实 `AgentInput`
5. 不允许先把结构化输入压平为摘要再传给 runtime

### 7.3 `Task.prompt` 语义

`Task.prompt` 继续保留，但正式语义收敛为：

1. task list 摘要
2. task detail 标题回退
3. 展示层兼容字段

它不是：

1. 原始输入的 source of truth
2. create / resume 输入重建依据

## 8. Runtime Config

### 8.1 显式配置原则

create task 时，后端只负责校验，不负责兜底：

1. executor 是否受支持
2. model 是否属于当前 executor
3. effort 是否被当前 model 支持
4. executionMode 是否属于允许枚举值

### 8.2 默认值归属

系统可以存在默认值选择，但它属于前端产品层，而不是 project domain 或 task application 的 fallback 逻辑。

因此：

1. 前端进入 create 场景时应展示明确值
2. 后端收到的 create 请求应已经是完整 snapshot
3. project settings 不再驱动 create runtime fallback

### 8.3 Resume Override

resume 时：

1. `model` 可覆盖
2. `effort` 可覆盖
3. `executor` 不可覆盖
4. 成功 resume 后，task 的当前 runtime snapshot 应回显最新已接受值

## 9. Cancel Semantics

### 9.1 目标状态

用户主动发起且被系统接受的 cancel，其目标状态必须是 `cancelled`，而不是 `failed`。

### 9.2 竞争约束

terminal transition 必须满足 compare-and-set 语义：

1. 只有当前状态仍是 `running` 时，才能写入 terminal 状态
2. `completed` / `failed` / `cancelled` 谁先成功写入谁赢
3. 一旦 `cancelled` 已落库，后续 completion/failure 不得覆盖它

### 9.3 事件语义

建议至少保留两类 Harbor synthetic 事件：

1. `harbor.cancel_requested`
2. `harbor.cancelled`

前端不应依赖 provider-specific raw error 来推断“这是不是用户取消”。

## 10. Output Schema

### 10.1 语义

`outputSchema` 是单轮输出约束，不是 task 的持久化默认配置。

### 10.2 输入约束

1. `outputSchema` 顶层必须是 plain JSON object
2. 顶层不能是 array
3. 顶层不能是 `null`
4. 字段值必须可 JSON 序列化

### 10.3 executor support

当调用方传入 `outputSchema` 时：

1. 支持该能力的 executor 必须真正收到它
2. 不支持该能力的 executor 必须明确失败
3. 不允许静默忽略

## 11. 持久化与读取

### 11.1 用户输入持久化

create / resume 一旦通过业务校验并准备进入 runtime，Harbor 必须主动写入 user input event。

该事件必须保存：

1. 原始 `AgentInput`
2. 展示摘要
3. 当前 turn 使用的 `outputSchema`，若有

### 11.2 读取原则

1. raw event 是 source of truth
2. `/v1/tasks/:taskId/events` 继续返回 normalized event stream
3. task detail / task list 返回当前 task snapshot，而不是原始 runtime envelope

## 12. 验收标准

### AC-1 Create

1. `POST /v1/orchestrations/:orchestrationId/tasks` 支持 `prompt` 或 `items`
2. create 请求缺失任一 runtime 字段时失败
3. create 成功后 task snapshot 持有明确 `executor / model / effort / executionMode`

### AC-2 Resume

1. `POST /v1/tasks/:taskId/resume` 支持 `prompt` 或 `items`
2. resume 可覆盖 `model` / `effort`
3. resume 不允许切换 `executor`
4. resume 成功后 task snapshot 回显最新 runtime 值

### AC-3 Cancel

1. `POST /v1/tasks/:taskId/cancel` 可取消 `running` task
2. 取消成功后最终状态收敛到 `cancelled`
3. cancel 与 complete/fail 并发时，terminal 状态不会被后写覆盖

### AC-4 Output Schema

1. create / resume 可选接受 `outputSchema`
2. Codex 等支持方会真正收到该 schema
3. 不支持的 executor 会明确失败

### AC-5 Event Storage

1. create / resume 的用户输入事件由 Harbor 主动落库
2. 事件中保留原始输入
3. `Task.prompt` 只作为摘要，不作为真实输入来源
