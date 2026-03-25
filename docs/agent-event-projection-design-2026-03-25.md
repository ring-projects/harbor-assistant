# Agent Event Projection Design

- 日期：2026-03-25
- 状态：Accepted
- 适用范围：`packages/harbor-events`、后端 agent event 投射链路、前端 agent event 消费层

## 背景

Harbor 当前同时接入 `codex`、`claude-code` 等不同 provider。各 provider 的原始事件结构差异较大，但上层系统仍然需要一个稳定的 Harbor 事件模型来驱动：

- task 事件流查询
- 前端消息与活动展示
- 后续的分析、回放与调试

这要求我们引入一个独立的 projection 层，把 provider raw event 转换成 Harbor 自己的事件语义。

本次设计的重点不是“如何把事件变得更聪明”，而是先把边界收干净：

- `harbor-events` 只负责 projection
- projection 尽量保持无损
- 跨事件归并不放在 projection 包中
- 前端或上层服务自己做 reducer / view model 聚合

## 设计结论

`packages/harbor-events` 的定位明确为：

- 提供 event projection 相关 types
- 提供 `raw event -> Harbor event[]` 的 pure function

它不负责：

- 事件持久化
- 序列号换算
- 分页 / 游标
- 跨事件 stateful 归并
- 为 UI 生成最终展示模型
- 修补 provider 拆分事件导致的缺失字段

换句话说，`harbor-events` 是一个结构归一化层，不是一个读取层，也不是一个前端 view-model 层。

## 设计原则

### 1. 保持原始事件顺序

projection 不应重排原始事件流。

如果一条 raw event 投射成多条 Harbor event，这些 Harbor event 的顺序应完全由该条 raw event 内部的语义顺序决定，而不是依赖外部状态重新排序。

### 2. 尽量不修改原始语义

projection 可以统一命名和结构，但不应为了“更方便前端显示”而主动做有损转换。

典型禁止项：

- 把累计输出压缩成 delta 且不保留快照
- 用历史状态补齐本条 raw event 中不存在的字段
- 在 projection 层直接生成 UI 专用状态

### 3. 允许字段不完整

如果 provider 的事件协议本来就是拆开的，projection 层可以输出 partial event。

例如：

- `tool_use` 提供 `activityId`、`title`、`input`
- `tool_result` 只提供 `activityId`、`result`

这种情况下，不要求 projection 层必须把后者补齐成“完整 activity”。缺失字段允许交给消费侧按 `activityId` 自行归并。

### 4. 跨事件处理放到消费侧

如果前端要展示：

- command 的运行中状态
- tool call 的最终卡片
- command output 的逐步变化
- message / reasoning / activity 的混合时间线

这些都应由前端或上层服务使用 reducer 完成，而不是由 `harbor-events` 在 projection 时预先做掉。

## 当前包边界

当前 `packages/harbor-events` 暴露的核心接口应保持最小化：

- 类型：`RawAgentEventRecord`
- 类型：`HarborAgentEvent`
- 方法：`projectRawEvent(rawEvent)`

其中：

- `RawAgentEventRecord` 描述一条原始 provider 事件记录
- `HarborAgentEvent` 描述 Harbor 的统一事件模型
- `projectRawEvent` 将一条 raw event 映射为零条、一条或多条 Harbor event

这意味着：

- package 内不再维护 `ProjectionState`
- package 内不再暴露 stream 级 API
- package 内不再负责投射后记录包装

## Harbor Event 模型

当前 Harbor 事件分为四类：

- `lifecycle`
- `message`
- `reasoning`
- `activity`

### lifecycle

表示 session / turn / runtime 的生命周期状态变化。

典型用途：

- 标记一轮执行开始
- 标记一轮执行完成
- 标记运行期错误

### message

表示可以直接展示的消息文本。

典型用途：

- 用户输入
- assistant 输出

### reasoning

表示模型显式暴露的思考内容。

它是单独事件类型，不应该混进普通 assistant message。

### activity

表示外部可观察动作，例如：

- command
- web search
- mcp tool
- file change
- generic tool

`activity` 有几个重要特征：

- 它使用 `activityId` 作为跨事件关联键
- 它允许只携带当前 raw event 能确定的字段
- `phase` 只表达当前这条 event 在 activity 生命周期中的位置

当前 `phase` 为：

- `started`
- `progress`
- `completed`

## Provider Projection 约束

### Codex

Codex 的 command execution 当前应尽量保留 provider 语义，而不是转换成 Harbor 自己的增量协议。

例如：

- `item.started` -> `activity phase: started`
- `item.updated` / `item.completed` 中包含 `aggregated_output`
- projection 后的 `progress.output` 应保留当前可见输出快照，而不是只返回 delta

这样做的原因是：

- 避免有损转换
- 前端断线后更容易恢复
- 前端可以自己决定是做替换还是局部 diff

### Claude Code

Claude 的 `tool_use` 和 `tool_result` 原生就是拆开的。

因此 projection 只做当前事件可见信息的映射：

- `tool_use` -> `activity phase: started`
- `tool_result` -> `activity phase: progress/completed`

projection 不要求把 `tool_result` 强行补齐成完整 activity。

如果后续要展示完整卡片，消费侧应基于 `activityId` 自己做聚合。

## 为什么不在 projection 层做 stateful 归并

之前有一个直觉上的设计是：在 projection 层引入 `ProjectionState`，用来：

- 给 command output 计算 delta
- 把 `tool_use` 的 title / input 回填到后续 `tool_result`

这个方向的问题是，它会让 projection 层开始承担 reducer 职责，并带来几个副作用：

- output 可能变成有损数据
- event 重放依赖历史 state
- 中间漏事件时更难恢复
- package 边界开始向 query / UI 层漂移

因此当前结论是：

- `harbor-events` 不再做 stateful 归并
- event projection 保持 stateless
- 需要状态归并的地方放在消费侧

## 前端应该如何处理

前端不应该直接把每条 Harbor event 当成最终 UI 节点，而应该把它们视为事件流，然后做一次本地 reducer。

### 前端处理原则

前端应遵守以下原则：

- 按接收到的顺序处理事件
- 不自行改写事件类型
- 基于稳定 key 做局部归并
- 保留原始 Harbor event 流，便于调试和回放

### 建议的归并维度

建议前端至少维护两层数据：

1. 原始事件列表
- 保留收到的 `HarborAgentEvent[]`
- 用于时间线、调试、回放和错误排查

2. 派生视图状态
- 从原始事件流 reducer 出来的 UI view model
- 例如 command 卡片、tool 卡片、消息列表、执行状态栏

### activity 的前端 reducer

前端应基于 `activityId` 维护一个 `ActivityViewModel` 映射。

处理规则建议如下：

1. 收到 `phase = started`
- 新建 activity
- 初始化 `kind`、`title`、`input`、`summary`
- UI 状态记为 `running`

2. 收到 `phase = progress`
- 找到对应 activity
- 更新 `output` 或中间结果
- 如果 payload 中缺字段，不要清空已有字段

3. 收到 `phase = completed`
- 找到对应 activity
- 更新 `status`
- 更新 `result` / `error` / `metadata`
- UI 状态记为 `success` 或 `failed`

### command output 的处理建议

对于 command activity，前端不应该假设 `progress.output` 一定是 delta。

更稳妥的做法是：

- 把它视为“当前最新可见输出”
- 如果新输出以旧输出为前缀，则可在视图层只追加 delta
- 如果不满足此前缀关系，则直接以新输出整体替换当前显示

这样前端可以同时兼容：

- provider 原生快照输出
- 将来可能存在的增量输出
- 网络抖动或补拉导致的非连续事件

### Claude tool 的处理建议

由于 `tool_use` 与 `tool_result` 可能分开出现，前端需要接受以下事实：

- `started` 事件通常字段较完整
- `progress` / `completed` 事件可能只有部分字段

因此 reducer 必须采用“增量合并”而不是“整对象替换”。

规则是：

- 新事件提供了字段，就更新
- 新事件没提供字段，就保留旧值

### 生命周期事件的前端处理

前端应单独维护 run/session/turn 的状态，而不是把它们混入 activity reducer。

建议：

- `lifecycle scope=session` 更新会话状态
- `lifecycle scope=turn` 更新当前执行轮次状态
- `lifecycle scope=runtime` 更新运行时错误状态

这三者不应复用同一个 reducer 分支。

## 推荐的数据流

推荐的数据流如下：

1. 后端接收 provider raw event
2. 后端调用 `projectRawEvent(rawEvent)`
3. 后端将 `HarborAgentEvent[]` 原样推送给前端或写入自己的事件管道
4. 前端按顺序消费 Harbor event
5. 前端基于 event 流生成自己的 view model

关键点是：

- 后端负责 projection
- 前端负责 reducer / 呈现
- 两边都不应该重新解释 provider 协议之外的语义

## 对实现的直接约束

后续如果继续演进 `harbor-events`，应坚持以下约束：

1. 不重新引入 projection 内部状态缓存
2. 不在 package 内增加 stream / pagination API
3. 不在 package 内做投射后记录包装
4. 不为了前端展示方便而做有损转换
5. 如果某个 provider 事件字段不完整，允许输出 partial Harbor event

## 与 package README 的关系

`packages/harbor-events/README.md` 适合作为 package 级别说明。

本文档是更高层的设计归档，目的是明确：

- 为什么 `harbor-events` 要做成 pure projection package
- projection 与 reducer 的边界在哪
- 前端应该承担哪些事件消费责任
