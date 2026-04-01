# Task Structured Input Requirements

> [!WARNING]
> **状态：Partially Superseded**
> 本文档中的 create task 示例仍使用早期 `POST /v1/tasks`。
> 结构化输入能力本身仍有效，但当前 create task 的 canonical contract 已迁移到
> `POST /v1/orchestrations/:orchestrationId/tasks`。

## 1. 文档信息

- 文档名称：Task Structured Input Requirements
- 日期：2026-03-28
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/task`
  - `apps/service/src/lib/agents`
  - `apps/web/src/modules/tasks`
- 关联文档：
  - [task-api.md](./task-api.md)
  - [task-context-design-2026-03-25.md](./task-context-design-2026-03-25.md)
  - [task-event-storage-model.md](./task-event-storage-model.md)
  - [service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
  - [frd-task-frontend.md](./frd-task-frontend.md)
  - [tdd/task.md](./tdd/task.md)

## 2. 背景

当前 `task` 业务链路的输入能力存在三个明显问题：

1. `task` 对外和对内仍以 `prompt: string` 为主协议，无法稳定表达 `local_image`
2. 用户输入虽然会被 Harbor 追加为一条 `message(role=user)` 事件，但这条事件是运行时异步补写，不是 create / resume 边界内的同步持久化承诺
3. `Task.prompt` 同时承担“真实输入”和“展示摘要”两种职责，导致真实输入来源不清晰

与此同时，底层 agent runtime 已经具备更强输入能力：

1. `AgentInputItem` 已定义为：
   - `{ type: "text"; text: string }`
   - `{ type: "local_image"; path: string }`
2. `AgentInput` 已定义为：
   - `string | AgentInputItem[]`
3. `CodexAdapter` 已可原样向 SDK 透传 `local_image`

因此，本次改造的关键不是重新发明 runtime 类型，而是把现有输入能力稳定暴露到 task create / resume / event persistence / frontend composer 的业务链路里。

## 3. 目标

本需求文档只定义这次改造必须实现的业务目标，不讨论更远期的多模态扩展。

核心目标如下：

1. create / resume 都支持 `AgentInput`
2. 原始用户输入以 Harbor 主动写入的方式稳定落库
3. `ExecutionEvent` 成为用户输入的 source of truth
4. `Task.prompt` 保留，但只作为摘要字段
5. 前端支持本地图片粘贴、拖拽、上传，并将结果作为 `local_image` 进入 task 输入
6. 现有纯文本调用继续兼容

## 4. 非目标

本次改造不尝试解决以下问题：

1. 不新增 task hierarchy / lineage / orchestration 语义
2. 不引入新的 execution attempt 模型
3. 不要求 Claude Code 在 provider 层原生消费图片；它可以继续降级为文本提示
4. 不在本次改造中新增 raw event 调试查询 API
5. 不在本次改造中重写整个 chat UI 的视觉样式

## 5. 核心业务判断

### 5.1 输入协议判断

当前 task 业务应直接复用已有 `AgentInput`，即：

```ts
type AgentInput = string | AgentInputItem[]
```

本次不新增 task 专用输入基础类型，也不强制要求业务层“必须数组化”。

理由：

1. 现有 runtime 边界已经采用该类型
2. 纯文本输入仍是当前大量调用的现实形态
3. 本次改造的重点是“原始输入稳定落库 + agent 真正收到输入”，而不是人为收紧表达能力

### 5.2 source of truth 判断

本次改造完成后，必须明确：

1. `ExecutionEvent.rawPayload` 是用户输入与 agent 输出的 source of truth
2. `Task.prompt` 不是 source of truth
3. `Task.prompt` 只承担 task list / task detail / title fallback 的摘要职责

### 5.3 用户输入消息的归属判断

用户输入消息不应依赖 provider 回传。

理由：

1. 当前 provider runtime 不会稳定回传“用户原始输入记录”
2. Harbor 才知道 create / resume 请求边界与业务语义
3. 如果不由 Harbor 主动写入，就无法保证输入稳定落库

因此，create / resume 的用户输入消息应由 Harbor 主动写入 execution event。

## 6. 需求范围

### 6.1 后端输入协议

#### FR-1 create 支持 `AgentInput`

`POST /v1/tasks` 必须支持以下两种输入：

1. `prompt: string`
2. `items: AgentInputItem[]`

兼容规则：

1. 若请求只提供 `prompt`，系统按纯文本输入处理
2. 若请求提供 `items`，系统按结构化输入处理
3. 若两者都为空或无效，请求被拒绝

#### FR-2 resume 支持 `AgentInput`

`POST /v1/tasks/:taskId/resume` 必须支持与 create 相同的输入表达能力：

1. `prompt: string`
2. `items: AgentInputItem[]`

语义保持不变：

1. `resume` 继续同一个 `Execution`
2. `resume` 不创建新的 task
3. `resume` 不创建新的 execution

#### FR-3 runtime 边界使用 `AgentInput`

`task` 到 `agent runtime` 的内部调用必须以 `AgentInput` 作为真实输入类型。

禁止行为：

1. 先把结构化输入压平为摘要字符串，再传给 Codex
2. 从 `Task.prompt` 重新恢复真实输入

### 6.2 用户输入持久化

#### FR-4 用户输入必须由 Harbor 主动落库

create / resume 请求一旦通过业务校验并准备进入 runtime，Harbor 必须主动写入一条 execution user input event。

这条事件必须满足：

1. 写入方是 Harbor，而不是 provider 回传
2. 落库点位于 create / resume 的业务编排边界内
3. 它不依赖异步后台流程“顺手补写”

#### FR-5 execution event 必须保存原始输入

execution user input event 的 `rawPayload` 必须能够原样表达本次用户提交的 `AgentInput`。

允许的 payload 形态：

```json
{
  "role": "user",
  "source": "user_input",
  "input": "Run tests",
  "summary": "Run tests",
  "timestamp": "2026-03-28T00:00:00.000Z"
}
```

或：

```json
{
  "role": "user",
  "source": "user_input",
  "input": [
    { "type": "text", "text": "Review this image" },
    { "type": "local_image", "path": ".harbor/task-input-images/example.png" }
  ],
  "summary": "Review this image",
  "timestamp": "2026-03-28T00:00:00.000Z"
}
```

要求：

1. `input` 保存原始 `AgentInput`
2. `summary` 保存展示摘要
3. summary 只用于 UI 与兼容，不替代 `input`

#### FR-6 启动失败不应导致输入丢失

即使 agent 启动失败、resume 失败，create / resume 对应的用户输入事件也必须已经落库。

### 6.3 `Task.prompt` 语义收敛

#### FR-7 `Task.prompt` 仅作为摘要字段

`Task.prompt` 继续保留，但正式语义收敛为：

1. task list 摘要
2. task detail 标题回退
3. 兼容现有前端字段

禁止以下语义：

1. 把 `Task.prompt` 视为真实输入
2. 依赖 `Task.prompt` 重建 create / resume 输入
3. 假设 `Task.prompt` 一定包含图片相关信息

#### FR-8 首轮 create 的摘要必须可稳定生成

create 时系统必须从原始输入生成 `Task.prompt`：

1. 若输入是 `string`，摘要即该字符串
2. 若输入包含 text item，摘要取文本摘要
3. 若输入只有 `local_image`，摘要生成类似 `Attached 1 image` / `Attached N images`

resume 不要求更新 `Task.prompt`。

### 6.4 本地图片上传

#### FR-9 前端支持粘贴与拖拽图片

task create 与 task resume composer 都必须支持：

1. 粘贴图片
2. 拖拽图片
3. 本地图片上传后转成 `local_image.path`

#### FR-10 图片上传 API

后端必须提供 project-scoped 的 task input image upload API。

要求：

1. 文件写入 project 根目录下的 `.harbor/task-input-images`
2. 返回相对 project root 的路径
3. 返回值可直接作为 `local_image.path`

#### FR-11 图片类型与大小限制

至少支持：

1. `image/png`
2. `image/jpeg`
3. `image/webp`
4. `image/gif`

并限制单文件大小，防止异常输入直接压垮 service。

### 6.5 事件展示

#### FR-12 task conversation 必须可展示用户输入

前端 task conversation 对于用户输入事件必须支持：

1. 当 `input` 为 `string` 时按普通文本消息展示
2. 当 `input` 为 `AgentInputItem[]` 时同时展示：
   - text 内容
   - `local_image` 附件信息

第一阶段不强制要求图片缩略图，但至少必须可见附件条目或路径标识。

#### FR-13 pending / queued input 必须兼容图片

前端 queued / pending 输入状态不能只保存字符串。

要求：

1. 当用户在 running task 上排队下一次输入时，文本和图片都能被保留
2. 当前 turn 结束后自动续跑时，仍能发送相同输入

## 7. 数据库要求

### 7.1 当前最小数据库要求

仅从“让 execution 成为输入真相源”这个目标出发，现有数据库已经具备最关键的持久化能力：

1. `ExecutionEvent.rawPayload` 是 `Json`
2. 它足以保存 `string | AgentInputItem[]`

因此，本次需求不强制要求为了输入协议本身而新增独立输入子表。

### 7.2 可接受的数据库演进

如果后续需要更快读取首轮原始输入，可在 `Task` 上新增 `Json` 字段缓存首轮输入。

但该字段若存在，也只能视为首轮输入缓存，而不是替代 `ExecutionEvent` 的 source of truth。

## 8. 兼容策略

本次改造必须同时保证以下兼容性：

1. 老的纯文本 create 调用继续可用
2. 老的纯文本 resume 调用继续可用
3. 现有 task list / detail 继续读取 `Task.prompt`
4. 现有 event stream API 继续返回 normalized event，不直接泄露 raw storage record

兼容的底线是：

```text
Old text-only callers remain valid.
New structured-input callers become first-class.
```

## 9. 验收标准

本需求在以下条件全部成立时才算完成：

1. create / resume 都能接收 `AgentInput`
2. 用户输入事件由 Harbor 主动写入 execution event
3. execution event 中保存原始输入
4. `Task.prompt` 不再被当作真实输入源
5. Codex 能收到 `local_image`
6. 纯文本兼容链路继续可用
7. 前端能在 create / resume 场景下上传本地图片并在会话中展示输入附件
