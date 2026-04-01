# Task Output Schema Requirements

> [!WARNING]
> **状态：Partially Superseded**
> 本文档中的 create task 示例仍引用早期 `POST /v1/tasks`。
> `outputSchema` 相关约束仍可作为功能要求参考，但当前 create task 路径应视为
> `POST /v1/orchestrations/:orchestrationId/tasks`。

## 1. 文档信息

- 文档名称：Task Output Schema Requirements
- 日期：2026-03-31
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/task`
  - `apps/service/src/lib/agents`
  - `apps/web/src/modules/tasks/api`
- 关联文档：
  - [task-api.md](./task-api.md)
  - [task-runtime-system-design-2026-03-23.md](./task-runtime-system-design-2026-03-23.md)
  - [task-structured-input-requirements-2026-03-28.md](./task-structured-input-requirements-2026-03-28.md)
  - [task-explicit-runtime-config-requirements-2026-03-30.md](./task-explicit-runtime-config-requirements-2026-03-30.md)
  - [tdd/task-output-schema.md](./tdd/task-output-schema.md)

## 2. 背景

当前 Harbor 的 task create / resume 已经支持：

1. 显式 runtime config（`executor / model / effort / executionMode`）
2. 结构化输入（`prompt` 或 `items`）
3. provider-native event 流持久化

但对于“要求 agent 以某个 JSON 结构返回最终结果”这类诉求，当前 service 仍然缺一段关键能力：

1. 底层 `codex` CLI 已支持 `--output-schema`
2. 当前仓库安装的 `@openai/codex-sdk` 也已支持 turn 级 `outputSchema`
3. Harbor service 现有执行链路仍未暴露这个参数
4. 因此 create / resume API 无法把结构化输出约束传给 Codex

这带来几个实际问题：

1. 用户只能靠 prompt “尽量要求返回 JSON”，但不能获得稳定约束
2. service 无法区分“普通自然语言回复”与“本轮需要结构化输出”
3. 事件流中也无法记录这轮 turn 曾请求过怎样的输出 schema
4. 后续如果要让前端安全消费结果，就缺少明确 contract 基础

本轮要解决的不是“Harbor 自己解析并消费所有结构化结果”，而是先把 `outputSchema` 作为一项可选的 turn-level runtime directive 正式接入 service contract。

## 3. 目标

本需求文档定义的目标如下：

1. 为 `create task` 与 `resume task` API 增加可选 `outputSchema`
2. 让 Harbor 在运行 Codex 时把该 schema 透传给底层 SDK / CLI
3. 明确 `outputSchema` 的语义是“本次 turn 的输出约束”，而不是 task 永久配置
4. 在 Harbor 的 synthetic user input event 中记录本轮请求使用的 `outputSchema`
5. 对不支持该能力的 executor 给出明确失败，而不是静默忽略
6. 保持现有 `prompt / items` 输入路径、event streaming、task summary 语义不变

## 4. 非目标

本次改造不处理以下问题：

1. 不在本轮设计前端 schema builder UI
2. 不在本轮把 assistant 最终回复额外解析成 Harbor 内部 typed object
3. 不在本轮支持除 Codex 之外的 executor 结构化输出能力适配
4. 不在本轮把 `outputSchema` 提升为 task 持久化默认配置
5. 不在本轮做 schema registry、schema 复用模板或版本管理
6. 不在本轮改变 assistant message / conversation block 的展示模型

## 5. 核心判断

### 5.1 `outputSchema` 是 turn 级指令，不是 thread 级 runtime config

这是本次设计里最重要的一条判断。

当前 Harbor 的 `runtimeConfig` 主要描述 thread / session 的执行条件：

1. 用哪个 executor
2. 用哪个 model
3. 用什么 effort
4. 用什么 execution mode

而 `outputSchema` 的语义不是这些长期配置。

它描述的是：

1. 本轮回复希望满足什么 JSON 结构
2. 这项约束可能只对当前一次 create / resume 生效
3. 下一轮可以不带 schema，也可以换一个完全不同的 schema

因此：

1. `outputSchema` 不能并入当前 `TaskRuntimeConfig`
2. `outputSchema` 应作为单次 turn 的 request directive 进入 runtime 边界
3. Harbor 需要在类型层把 thread-level runtime options 与 turn-level options 区分开

### 5.2 API contract 以“可选字段”方式扩展，而不是替换现有输入协议

create / resume 的 request body 继续保留现有输入方式：

1. `prompt`
2. `items`
3. 显式 runtime config

在此基础上新增：

1. `outputSchema?: Record<string, unknown>`

也就是说：

1. 不要求所有 task 都传 `outputSchema`
2. 不影响现有没有结构化输出诉求的调用方
3. 传入时才进入结构化输出模式
4. 未传入时，行为与今天保持一致

### 5.3 `outputSchema` 顶层必须是 plain JSON object

因为底层 Codex CLI / SDK 接收的是 JSON Schema 对象，所以 Harbor 也应把 contract 收敛为：

1. 顶层必须是 object
2. 顶层不能是 array
3. 顶层不能是 `null`
4. 字段值必须可 JSON 序列化

本轮不要求 Harbor 完整理解所有 JSON Schema 方言细节。

Harbor 只做两层最低限度校验：

1. HTTP / request 层：确认顶层是 object
2. application / runtime 层：确认它是 plain JSON object，且可安全序列化

更深的 schema 语义正确性仍以底层 provider / CLI 的报错为准。

### 5.4 executor support 必须显式，不允许静默忽略

当调用方传入 `outputSchema` 时，如果当前 executor 不支持该能力，Harbor 不应：

1. 悄悄忽略掉这个字段
2. 继续按普通任务执行
3. 让用户误以为已经启用了结构化输出约束

因此本轮 canonical behavior 是：

1. `codex`：支持 `outputSchema`
2. `claude-code`：当前阶段视为不支持
3. 当 `executor !== "codex"` 且请求携带 `outputSchema` 时，create / resume 直接失败并返回明确错误

后续如果别的 executor 具备同等能力，再通过 capability 扩展接入，而不是在本轮做宽松兼容。

### 5.5 `outputSchema` 应持久化进 synthetic user input event，而不是 task snapshot

为了便于审计、调试和后续 replay，Harbor 需要记录：

1. 用户这一轮输入了什么
2. 这一轮是否附带 `outputSchema`

但这个信息不应该写进长期 task snapshot，原因是：

1. 它不是 task 恒定属性
2. 它可能只在某一轮 turn 生效
3. 写进 task record 会制造“当前 task 永远绑定这个 schema”的误解

因此本轮要求：

1. `Task.prompt` 仍只承担 summary 职责
2. `Execution` / `TaskRuntimeConfig` 不新增默认 `outputSchema` 字段
3. synthetic user input event 增加 `outputSchema` 字段，与 `input / summary / source` 并列

推荐 payload 形态：

```json
{
  "role": "user",
  "content": "Return JSON for the next step",
  "summary": "Return JSON for the next step",
  "input": "Return JSON for the next step",
  "outputSchema": {
    "type": "object",
    "required": ["doc", "actions"]
  },
  "source": "user_input"
}
```

### 5.6 第一阶段只做“传递约束”，不做 Harbor 内部结果解析

本轮的完成定义不是“Harbor 已经能把 assistant message 自动解析成对象”。

本轮只要求：

1. 请求能带 `outputSchema`
2. Codex 真正收到这个 schema
3. assistant 的最终文本回复被该 schema 约束
4. Harbor 正常保存原始 assistant message

换句话说：

1. Harbor 仍把 assistant 最终输出视为 provider message 文本
2. 前端若想把该文本再做 JSON.parse，是下一阶段能力
3. 这能显著降低本轮实现面，先锁定 runtime contract

## 6. Canonical Contract

### 6.1 Create Task body 扩展

`POST /v1/tasks` 在现有字段上新增：

- `outputSchema?: object`

示例：

```json
{
  "projectId": "project-1",
  "prompt": "Summarize the code changes and suggest next actions.",
  "executor": "codex",
  "model": "gpt-5.3-codex",
  "executionMode": "safe",
  "effort": "medium",
  "outputSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["doc", "actions"],
    "properties": {
      "doc": { "type": "string" },
      "actions": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["label"],
          "properties": {
            "label": { "type": "string" }
          }
        }
      }
    }
  }
}
```

### 6.2 Resume Task body 扩展

`POST /v1/tasks/:taskId/resume` 在现有字段上新增：

- `outputSchema?: object`

这表示“下一轮恢复执行时，要求 final response 满足此 schema”。

如果不传，则 resume 行为与今天保持一致。

### 6.3 Service 内部类型分层

为避免把 turn-level 语义塞进 `TaskRuntimeConfig`，本轮建议引入独立类型，例如：

- `AgentTurnOptions`
- `TaskTurnOptions`
- `TaskInvocationOptions`

命名可以再讨论，但语义必须明确：

1. `runtimeConfig`：描述 executor / model / effort / executionMode
2. `turnOptions`：描述 `outputSchema` 这类单轮行为约束

推荐最小 contract：

```ts
type AgentTurnOptions = {
  outputSchema?: Record<string, unknown>
}
```

然后由 task runtime boundary 继续往下透传。

### 6.4 Codex adapter 映射方式

Codex adapter 不应尝试把 `outputSchema` 放入 `ThreadOptions`。

正确映射是：

1. `ThreadOptions` 仍只承载 thread 级配置
2. `thread.runStreamed(input, { signal, outputSchema })` 负责传递 turn 级 schema

也就是说，本轮的核心代码路径应从：

```ts
thread.runStreamed(input, { signal })
```

收敛为：

```ts
thread.runStreamed(input, {
  signal,
  outputSchema,
})
```

### 6.5 Unsupported executor 的失败语义

当请求带有 `outputSchema` 但 executor 不支持时：

1. route 可以先放行该字段
2. application / runtime validation 必须在启动 runtime 前失败
3. 错误消息应尽量明确，例如：
   - `Executor "claude-code" does not support outputSchema.`

这样可以避免把 executor 能力判断硬编码在 HTTP schema 层，同时又能保证失败尽可能早。

## 7. 设计约束

### 7.1 不改变现有 summary 语义

1. `Task.prompt` 继续保存输入摘要
2. synthetic user input event 继续保存原始输入
3. `outputSchema` 只是该 event 的附加上下文，不改变摘要生成规则

### 7.2 不引入 task 级默认 schema

以下设计本轮都不做：

1. project 保存默认 `outputSchema`
2. task record 保存默认 `outputSchema`
3. resume 自动继承上轮 `outputSchema`

原因是这些都会把单轮约束误建模成长期配置。

### 7.3 不要求前端本轮就消费 typed result

前端第一阶段只需要：

1. 能把 `outputSchema` 发给 service
2. 能继续显示 assistant 原始回复
3. 如需 JSON.parse，由上层业务自行决定

## 8. 实现边界建议

建议改动范围集中在以下几层：

1. task route body schema
2. task create / resume use case input contract
3. task runtime port / execution driver
4. `lib/agents` runtime types
5. Codex adapter
6. synthetic user input event payload
7. 前端 task API client

不建议本轮同时改：

1. conversation block 展示模型
2. task list / detail read model
3. 非 Codex executor capability registry 的大重构

## 9. 验收标准

当以下条件同时成立时，可以认为本轮 `outputSchema` 接入完成：

1. `POST /v1/tasks` 可选接受 `outputSchema`
2. `POST /v1/tasks/:taskId/resume` 可选接受 `outputSchema`
3. `codex` executor 收到该 schema，并通过 SDK 透传到底层 CLI
4. synthetic user input event 能看到 `outputSchema`
5. 不支持该能力的 executor 在 create / resume 时明确失败
6. 未传 `outputSchema` 的老请求行为不变
7. 现有结构化输入、图片输入、summary 语义不被破坏

## 10. 后续可演进方向

这轮完成后，下一阶段才值得讨论：

1. 是否在前端增加 schema preset / schema editor
2. 是否在 conversation block 中把可解析 JSON 做结构化展示
3. 是否在 Harbor 内部引入 `parsedOutput` / `finalResponseJson`
4. 是否为不同 executor 建立统一 `supportsOutputSchema` capability
5. 是否支持 task 级 reusable output schema presets
