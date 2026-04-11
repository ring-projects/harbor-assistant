# Agent Event 重构方案

> Historical refactor plan. Keep this document as a dated design exploration,
> not as the current event model definition.

最后更新：2026-03-24

## 1. 目的

这份文档用于提出 Harbor 当前 agent 投影事件模型的重写方案。

这次重构的目标不是修改 raw event 的存储契约。数据库里保存的 raw stored events 仍然是唯一的 source of truth。

这次重构的目标是替换当前的归一化 `AgentEvent` 结构，设计一套更清晰的 read-model event schema，使它：

- 更容易在不同 runtime 之间保持一致的投影逻辑
- 避免顶层事件类型不断膨胀
- 避免为了适配某一个 runtime 的工具分类而过度设计
- 去掉 `command`、`web_search`、`mcp_tool_call` 之间的结构性重复

## 2. 当前问题

当前的 `AgentEvent` 类型把过多不同层级的概念揉进了一个平铺 union 里。

现在它同时包含：

- 生命周期事件
- 对话事件
- reasoning 事件
- plan / todo 事件
- command 执行事件
- web search 事件
- MCP 工具调用事件
- file change 事件
- failure 事件

这会带来几个明显问题。

### 2.1 抽象层级混杂

有些事件是偏高层、偏 UI 的概念：

- `message`
- `reasoning`

有些事件是偏底层的 runtime activity 分类：

- `command.started`
- `mcp_tool_call.completed`
- `web_search.started`

还有一些事件是 workflow lifecycle 标记：

- `session.started`
- `turn.completed`
- `turn.failed`

这些概念不应该作为一组彼此无关的顶层 sibling 平铺在一起。

### 2.2 Runtime 映射不一致

目前 Codex 的 projector 会把：

- shell command execution 投成 `command.*`
- web search 投成 `web_search.*`
- MCP 工具调用投成 `mcp_tool_call.*`

而 Claude 的 projector 目前基本把通用 tool activity 都压成：

- `command.started`
- `command.output`
- `command.completed`

这意味着“agent 使用了一个工具”这个概念，在不同 runtime 下被投影成了不同形状。

### 2.3 顶层事件族会继续膨胀

如果沿用当前模型，未来新增能力时很可能还会继续加新的顶层事件族，例如：

- `subagent.*`
- `http_request.*`
- `db_query.*`
- `tool_call.*`

这样 union 会继续扩张，projector 之间也会越来越难保持一致。

### 2.4 有些类型过于专用，或者语义基础不够稳定

例如：

- `message.source: string` 太宽，不是一个稳定契约
- `session.completed` 在当前 runtime 语义下基础并不牢靠
- `error` 和 `turn.failed` 之间存在失败语义重叠
- `todo_list` 非常专用，但没有足够清晰的理由继续保留成顶层事件类型

## 3. 设计目标

投影出来的事件模型应该被视为 Harbor 的 read model，而不是伪装成一个“统一的 runtime 协议”。

这意味着：

- runtime 之间的原始差异可以继续留在 raw storage 层
- 投影后的 schema 只归一 Harbor 真正需要消费的部分
- 顶层事件类别应该尽可能稳定，而且数量尽可能少

## 4. 建议的新顶层事件模型

建议把当前的平铺 union 改成四类顶层事件：

- `lifecycle`
- `message`
- `reasoning`
- `activity`

推荐结构如下：

```ts
export type TaskAgentEvent =
  | {
      type: "lifecycle"
      scope: "session" | "turn" | "runtime"
      phase: "started" | "completed" | "failed" | "error"
      timestamp: Date
      sessionId?: string
      error?: string
      metadata?: Record<string, unknown>
    }
  | {
      type: "message"
      role: "user" | "assistant" | "system"
      content: string
      timestamp: Date
      source?: string
      externalId?: string
    }
  | {
      type: "reasoning"
      content: string
      timestamp: Date
      source?: string
    }
  | {
      type: "activity"
      activityId: string
      kind:
        | "command"
        | "web_search"
        | "mcp_tool"
        | "file_change"
        | "tool"
        | "unknown"
      phase: "started" | "progress" | "completed"
      timestamp: Date
      title: string
      status?: "success" | "failed"
      summary?: string
      input?: unknown
      output?: string
      result?: unknown
      error?: string
      metadata?: Record<string, unknown>
    }
```

## 5. 为什么推荐这个结构

### 5.1 Lifecycle 结构更清晰

现在的模型里是：

- `session.started`
- `turn.started`
- `turn.completed`
- `turn.failed`
- `error`

建议改成：

- `type: "lifecycle"`
- `scope`
- `phase`

这样可以减少顶层类型碎片，让结构更具组合性。

示例：

```ts
{
  type: "lifecycle",
  scope: "session",
  phase: "started",
  sessionId: "thread-123",
  timestamp: new Date(),
}
```

```ts
{
  type: "lifecycle",
  scope: "turn",
  phase: "failed",
  error: "Tool execution failed.",
  timestamp: new Date(),
}
```

### 5.2 Message 仍然保留

`message` 仍然应该保留为一类独立事件，因为它是系统中最稳定、最核心、也最直接面向 UI 的内容单元。

### 5.3 Reasoning 仍然保留

`reasoning` 也建议继续保留，因为它在产品意义和展示方式上都与普通 `message` 不同。

### 5.4 所有“agent 做了一件事”统一归入 `activity`

这是这次重构的核心。

不要再把下面这些作为不同的顶层事件族：

- `command.*`
- `web_search.*`
- `mcp_tool_call.*`
- `file_change`

它们本质上都属于“agent 执行了某个 activity”。

它们的区别主要来自：

- kind 不同
- phase 不同
- payload 结构不同

既然如此，它们更适合被建模为同一个事件族，在内部通过 `kind` 区分，而不是继续作为多个彼此无关的顶层 union。

## 6. Session 和 Turn 的区别

这个区别是重要的，应该在 lifecycle 模型里继续保留。

### 6.1 Session

`session` 表示 agent conversation / thread 对应的长期上下文执行容器。

它回答的问题包括：

- Harbor 当前绑定的是哪个 upstream thread / session
- 后续 follow-up 应该挂到哪个上下文上继续执行
- 系统应该保存哪个 session identifier 用于 resume

例子：

- Codex 的 `thread.started`
- Claude 的 synthetic session-start 事件

### 6.2 Turn

`turn` 表示 session 内的一次具体执行轮次。

它回答的问题包括：

- 当前这次 follow-up 是否已经开始
- 当前这轮是否还在运行
- 当前这轮是成功还是失败

示例时间线：

1. session 启动一次
2. 初始 prompt 触发 turn 开始
3. turn 完成
4. follow-up 触发下一次 turn 开始
5. 这次 turn 完成

也就是说：

- 一个 session 可以包含多个 turn
- session identity 和 turn lifecycle 是两个不同层次的问题

### 6.3 为什么两个都要保留

如果系统只保留 session lifecycle：

- follow-up 之间的轮次边界会变得模糊

如果系统只保留 turn lifecycle：

- resume 所依赖的 thread / session identity 会变得模糊

所以建议两个都保留，但统一落在一类 `lifecycle` 事件里表达。

## 7. `command`、`web_search`、`mcp_tool_call` 的重复问题

这是当前 schema 最大的结构性问题之一。

### 7.1 当前问题

现在 schema 把这些作为顶层平级事件族：

- `command.started/output/completed`
- `web_search.started/completed`
- `mcp_tool_call.started/completed`

但它们并不是和 `message`、`reasoning` 同一层次的概念。

它们本质上都是 activity kind。

### 7.2 建议规则

所有 tool-like / operation-like 工作统一投影为：

```ts
{
  type: "activity",
  kind: ...,
  phase: ...,
  ...
}
```

也就是：

- command execution -> `activity(kind: "command")`
- web search -> `activity(kind: "web_search")`
- MCP invocation -> `activity(kind: "mcp_tool")`
- generic tool activity -> `activity(kind: "tool")`
- file change -> `activity(kind: "file_change")`

### 7.3 这样做的好处

好处包括：

- 顶层事件族更少
- 多 runtime 的映射更自然
- 将来新增 activity kind 时不需要继续扩顶层 union
- Claude 和 Codex 更容易对齐，而不是强行做错误归一

## 8. 各 Runtime 的投影规则建议

### 8.1 Codex 的投影建议

建议映射关系：

- `thread.started` -> `lifecycle(scope: "session", phase: "started")`
- `turn.started` -> `lifecycle(scope: "turn", phase: "started")`
- `turn.completed` -> `lifecycle(scope: "turn", phase: "completed")`
- `turn.failed` -> `lifecycle(scope: "turn", phase: "failed")`
- `error` -> `lifecycle(scope: "runtime", phase: "error")`
- `agent_message` -> `message`
- `reasoning` -> `reasoning`
- `command_execution` -> `activity(kind: "command")`
- `web_search` -> `activity(kind: "web_search")`
- `mcp_tool_call` -> `activity(kind: "mcp_tool")`
- `file_change` -> `activity(kind: "file_change")`

### 8.2 Claude 的投影建议

建议映射关系：

- synthetic session start -> `lifecycle(scope: "session", phase: "started")`
- synthetic turn start -> `lifecycle(scope: "turn", phase: "started")`
- result success -> `lifecycle(scope: "turn", phase: "completed")`
- result failure -> `lifecycle(scope: "turn", phase: "failed")`
- runtime error -> `lifecycle(scope: "runtime", phase: "error")`
- assistant 可见文本 -> `message`
- `thinking` -> `reasoning`
- `tool_use` / `tool_result` -> `activity`

Claude 这里有一条很重要的规则：

- 不要再把所有 tool event 默认投成 `command`
- 只有在明确能识别为 shell / command execution 时才映射成 `kind: "command"`
- 只有在明确能识别为 MCP tool 时才映射成 `kind: "mcp_tool"`
- 无法稳定判断时统一投成 `kind: "tool"`

这样可以去掉当前代码里那种“为了兼容而错误归类”的妥协。

## 9. 建议删除或降级的现有类型

建议直接从当前 projected schema 里删除：

- `session.completed`
- `todo_list`
- `command.started`
- `command.output`
- `command.completed`
- `web_search.started`
- `web_search.completed`
- `mcp_tool_call.started`
- `mcp_tool_call.completed`
- `file_change`

建议转换为新结构：

- `session.started` -> `lifecycle`
- `turn.started` -> `lifecycle`
- `turn.completed` -> `lifecycle`
- `turn.failed` -> `lifecycle`
- `error` -> `lifecycle`
- `message` -> 保留
- `reasoning` -> 保留

### 9.1 关于 `todo_list`

除非 Harbor 已经有非常明确、稳定的 UI 功能依赖 `todo_list`，否则它不应该继续作为顶层 projected event。

更合理的处理方式是：

- 把它降级成 generic `activity`
- 或者只作为前端 block mapper 的派生结构
- 或者干脆不进入核心 projected schema

## 10. 迁移顺序建议

建议按以下顺序进行：

1. 先定义新的 projected event schema。
2. 更新 raw-event projectors，让它们产出新的 schema。
3. 更新 query / read-model 消费逻辑。
4. 更新前端 block mappers。
5. 删除旧的 `AgentEvent` 平铺 union。
6. 清理那些仅为了支持旧重复事件族而存在的 projector 逻辑。

## 11. 核心结论

这次重构最核心的决定是：

不要继续扩展一个平铺的、不断增长的具体事件 union。

而应该改成：

- 保留 `message`
- 保留 `reasoning`
- 用 `scope + phase` 建模 lifecycle
- 用统一的 `activity` 事件族承载所有操作和工具行为

这样 Harbor 才能得到一套更稳定的 read-model 契约，同时继续把 raw runtime events 保持为 source of truth。
