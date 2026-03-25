# @harbor/harbor-events

`@harbor/harbor-events` 用来将不同 Agent Provider 的原始事件投射为 Harbor 自己的事件模型。

这个包的职责不是 Agent 调度，也不是任务存储；它只做一件事：

- 输入原始 Agent 事件
- 输出 Harbor 可消费的归一化事件数组

## 设计目标

- 将 `codex`、`claude-code` 的原始事件统一转换为 Harbor 事件
- 保留 provider 原始事件的差异，但把上层真正关心的信息抽出来
- 让上层系统以稳定的事件结构消费消息、推理、生命周期和活动记录
- 避免把 provider SDK 的细节直接扩散到业务域

## 当前边界

这个包当前负责：

- 定义 Harbor 事件类型
- 定义原始事件记录类型
- 基于 provider 类型执行投射
- 将一条原始事件映射为零条、一条或多条 Harbor 事件

这个包当前不负责：

- 启动 Agent
- 与 Codex / Claude SDK 通信
- 存储原始事件
- 决定任务状态机
- 流式分页
- 序列号回推
- 跨事件状态归并
- WebSocket / SSE 推送

## 核心概念

### 1. RawAgentEventRecord

这是投射层的输入。它表示“已经落库或已经标准化后的原始 Agent 事件”。

关键字段：

- `agentType`: 当前事件来自哪个 provider，目前支持 `codex` 和 `claude-code`
- `rawEventType`: provider 原始事件类型
- `rawPayload`: provider 原始 payload
- `sequence`: 原始事件序列号
- `createdAt`: 原始事件时间

这里不再强调“stored”，因为这个包不关心事件是否已经落库。它只关心输入是一条带顺序的原始事件记录。

### 2. HarborAgentEvent

这是投射层的输出事件模型，目前分四类：

- `lifecycle`
- `message`
- `reasoning`
- `activity`

上层系统应该优先面向这个模型编程，而不是直接依赖 provider payload。

## 导出 API

### 类型导出

包导出了以下核心类型：

- `RawAgentEventRecord`
- `HarborAgentEvent`

### 单条原始事件投射

- `projectRawEvent(rawEvent)`

## 事件模型说明

### lifecycle

用于表达 session / turn / runtime 的生命周期变化。

示例：

- session started
- turn started
- turn completed
- turn failed
- runtime error

### message

用于表达用户消息、助手消息等可直接展示的文本。

示例：

- 用户输入 prompt
- Codex assistant message
- Claude assistant message

### reasoning

用于表达模型显式暴露的思考内容。

当前主要来自：

- Codex reasoning item
- Claude thinking block

### activity

用于表达工具、命令、搜索、文件变更等“可观察动作”。

当前 `kind` 包括：

- `command`
- `web_search`
- `mcp_tool`
- `file_change`
- `tool`
- `unknown`

注意：

- `activity` 事件允许只包含当前这条原始事件能够确定的字段
- 如果某些 provider 把一次 activity 拆成多条事件，上层应基于 `activityId` 自己做归并
- projection 不负责用历史状态补齐后续事件缺失的字段

## 使用方式

### 单条事件投射

```ts
import {
  projectRawEvent,
  type RawAgentEventRecord,
} from "@harbor/harbor-events"

const rawEvent: RawAgentEventRecord = {
  id: "raw_1",
  sequence: 10,
  agentType: "codex",
  rawEventType: "item.completed",
  rawPayload: {
    item: {
      id: "msg_1",
      type: "agent_message",
      text: "Hello from Codex",
    },
  },
  createdAt: new Date().toISOString(),
}

const projected = projectRawEvent(rawEvent)
```

## Provider 支持

### Codex

当前已处理的主要事件包括：

- `thread.started`
- `turn.started`
- `turn.completed`
- `turn.failed`
- `error`
- `item.started`
- `item.updated`
- `item.completed`

当前重点支持的 item 类型包括：

- `command_execution`
- `agent_message`
- `reasoning`
- `web_search`
- `file_change`

### Claude Code

当前已处理的主要事件包括：

- `assistant`
- `result`
- `system.result`
- `error`

其中：

- `assistant` 负责解析文本、thinking、tool_use、tool_result
- `result` / `system.result` 负责投射 turn 结束态

### Synthetic Harbor 事件

如果原始事件的 `rawEventType` 以 `harbor.` 开头，会走 synthetic projector。

当前已支持：

- `harbor.user_prompt`
- `harbor.session.started`
- `harbor.turn.started`
- `harbor.turn.completed`
- `harbor.error`

## 接入约束

接入这个包时，需要满足以下前提：

- `rawPayload` 应尽量保留 provider 原始结构，不要提前做过度转换
- 如果上层需要 activity 聚合、命令输出 diff 或 UI 状态归并，应在消费侧自行处理

## 现状说明

这个包当前已经收敛到“单条原始事件 -> Harbor 事件数组”的纯投射层。分页、游标、序列回推、跨事件归并和前端展示状态都应该放在上层服务或前端中实现。
