# Harbor Assistant Chat 前端设计文档（FRD）

## 1. 文档信息

- 文档名称：Chat Frontend Requirements Document
- 版本：v1.0
- 日期：2026-03-20
- 适用范围：项目工作台中的 Chat 面板、消息流、输入区、实时状态反馈
- 关联文档：
  - [product-prd-2026-04-10.md](./product-prd-2026-04-10.md)
  - [orchestration-requirements-2026-03-31.md](./orchestration-requirements-2026-03-31.md)
  - [agent-runtime-integration.md](./agent-runtime-integration.md)
  - [task-event-storage-model.md](./task-event-storage-model.md)

---

## 2. 背景与问题

Harbor 当前的 Chat 已经具备以下基础能力：

1. 展示 task 的 agent event stream
2. 支持 follow-up
3. 支持图片附件输入
4. 支持流式状态展示
5. 支持命令 / 工具调用 / 执行事件的结构化呈现

但从产品和前端实现角度看，当前 Chat 仍处于“功能可用、体验未定型”的阶段，主要问题包括：

1. **信息层级不够清楚**
   - user / assistant / event / command / tool/search/file-change 视觉优先级接近
   - 长消息、工具事件、运行状态会互相争抢注意力

2. **实时感不够自然**
   - Chat 能显示 running/typing，但“agent 正在做什么”的节奏还不够清楚
   - 用户很难快速判断：是正在回复、正在执行命令、还是被阻塞

3. **输入区体验还不够产品化**
   - 输入区虽然已支持图片、粘贴、拖拽，但“附件状态、操作控制、发送反馈”还可以进一步整合

4. **前端性能风险已经出现**
   - 消息量增多后，完整渲染整条流会逐渐变重
   - 当前已引入窗口裁剪，但 Chat 仍需要更清晰的长期性能策略

本 FRD 的目标不是只定义“怎么显示消息”，而是定义：

1. Chat 在 Harbor 中的产品角色
2. Chat 的信息架构
3. Chat 的状态与交互规范
4. Chat 的组件分层与前端实现原则
5. Chat 的性能与可扩展方向

---

## 3. 产品定位

Harbor 的 Chat 不是通用 IM，也不是简单日志查看器。

它应被定义为：

**项目级 AI 工作对话面板（Project-native AI Work Chat）**

也就是说，Chat 需要同时承担三类信息：

1. **用户意图**
   - 用户发给 agent 的 prompt / follow-up / 图片上下文

2. **agent 主回复**
   - assistant 产出的自然语言结果、说明、总结、下一步建议

3. **执行轨迹**
   - command、tool、search、file change、reasoning、error

这三类信息不能被混成一种列表项，而应该有清晰层级：

1. 用户意图是“输入回执”
2. assistant 回复是“主内容”
3. 执行轨迹是“辅助证据”

---

## 4. 设计目标

## 4.1 主目标

1. **让用户快速读懂 agent 在做什么**
2. **让 assistant 回复成为视觉中心**
3. **让执行轨迹可追踪但不过度打扰**
4. **让输入区像真正可长期使用的工作输入器**
5. **让长会话下仍可保持流畅**

## 4.2 非目标

当前阶段不追求：

1. 通用群聊/多人协作能力
2. 富文本编辑器式 message composer
3. 聊天主题、reaction、已读状态
4. 完整消息树/多分支 thread UI

---

## 5. Chat 信息架构

## 5.1 Chat 面板结构

Chat 面板应分为三层：

1. **Header**
   - Chat 标题
   - 当前 task 标题
   - 当前 executor / model / status 摘要
   - 当前运行控制（如 Break）

2. **Message Stream**
   - assistant / user 主消息
   - event / tool/search/file-change / command 轨迹块
   - typing / running 状态
   - 历史窗口与加载更早消息入口

3. **Composer**
   - 文本输入
   - 图片附件
   - model / mode / control chips
   - helper text / error / footer info
   - send action

## 5.2 信息优先级

从高到低：

1. assistant message
2. user message
3. running status / typing
4. command group
5. tool/search/file-change block
6. passive event

实现上不应让 passive event 和 assistant message 使用同等级视觉样式。

---

## 6. 消息模型与显示策略

## 6.1 消息类型

当前前端已经抽象为 `ChatConversationBlock`，但要明确：

1. `ChatConversationBlock` 是 query projection / UI view model
2. 它不是数据库持久化模型
3. raw task events 必须保留 agent 原始语义，chat block 在 query 时生成

当前 chat block 类型包括：

1. `message`
2. `event`
3. `file-change`
4. `web-search`
5. `mcp-tool-call`
6. `command-group`
7. `typing`

该抽象方向正确，应继续保留。

## 6.2 每类消息的产品职责

### 6.2.1 `message`

职责：

1. 承载 user / assistant 的主交流内容
2. assistant message 是最重要内容

要求：

1. assistant message 宽度、排版、代码块、段落节奏优先优化
2. user message 保持紧凑，像用户输入回执
3. pending user message 要与正式消息视觉上连续

### 6.2.2 `command-group`

职责：

1. 展示命令执行过程
2. 汇总 started/output/completed 三类事件

要求：

1. 默认展示命令摘要，不默认展开全部 output
2. output 过长时折叠
3. running / success / failed 状态明确但不抢视觉中心

### 6.2.3 `file-change`

职责：

1. 展示文件变更结果
2. 作为改动证据入口

要求：

1. 第一屏展示改动摘要与状态
2. 详细内容通过 drawer 或 secondary view 展开

### 6.2.4 `web-search`

职责：

1. 展示 web search 的 query 与状态
2. 作为搜索行为的独立 UI 类型

要求：

1. 不应和其他工具执行卡片复用完全相同的摘要字段
2. query 应在第一屏可读
3. 详细 payload 可在 drawer 中查看

### 6.2.5 `mcp-tool-call`

职责：

1. 展示 MCP server、tool、arguments、result、error
2. 保留工具调用的结构化细节

要求：

1. arguments / result / error 的视觉结构必须区别于 web search
2. 第一屏展示 tool identity，详细内容在 drawer 中展开

### 6.2.6 `event`

职责：

1. 展示辅助性系统事件
2. 比如 message source、error、turn.failed

要求：

1. 作为中性弱提示，不应抢夺正文注意力

### 6.2.7 `typing`

职责：

1. 表达 agent 正在响应

要求：

1. 视觉轻量
2. 与 running 状态一致
3. 不应造成消息流跳动或过高视觉噪音

---

## 7. Composer 设计原则

## 7.1 输入区产品定位

Composer 应被视为：

**一个带上下文能力的 agent 输入器**

不是普通 textarea。

它需要统一承载：

1. 文本 prompt
2. 图片附件
3. 发送动作
4. 当前 follow-up/create 的运行参数

## 7.2 输入能力

必须支持：

1. 文本输入
2. `Enter` 发送，`Shift+Enter` 换行
3. 点击选择图片
4. 粘贴图片
5. 拖拽图片
6. 附件预览与删除

## 7.3 控件策略

Composer controls 应保持“轻操作芯片化”，不要回退成传统表单：

1. model
2. execution mode
3. executor
4. image attachment entry

这些控件应作为 secondary controls，避免喧宾夺主。

## 7.4 发送反馈

发送后需要立即提供视觉反馈：

1. pending user message 先插入流中
2. send button 进入 submitting 状态
3. 图片附件清空
4. 若失败，pending prompt 清除并显示错误

---

## 8. Header 设计原则

Header 不应只是一个 `Chat` 标题。

它至少应该承担：

1. 当前 task 上下文
2. 当前 agent 运行状态
3. 当前运行控制

推荐最小信息集：

1. `Chat`
2. 当前 task title
3. executor badge
4. status badge
5. 可选 model badge
6. running 时展示 `Break`

如果当前 task 不能 follow-up，Header 或 Composer helper text 需要给出明确原因。

---

## 9. 性能设计

## 9.1 问题定义

Chat 性能风险来自两层：

1. 全量 blocks 转换成本
2. 全量 DOM 渲染成本

## 9.2 当前策略

当前前端已经引入“逻辑窗口”：

1. 默认只渲染最近一段消息
2. 向上滚动时逐步扩展历史
3. 回到底部时重新收缩窗口

这是正确方向，应保留。

## 9.3 后续优化路线

下一阶段建议：

1. **增量物化 conversation blocks**
   - 避免每次新事件都重跑整条 `toConversationBlocks`

2. **大块内容默认折叠**
   - command output
   - large JSON result
   - long assistant message

3. **必要时引入虚拟化**
   - 当逻辑窗口仍不足以支撑超长任务时，再接 `react-virtual`

## 9.4 性能目标

1. 长会话下 DOM 数量不应随总消息量无限线性增长
2. 新消息到达时，流式渲染应保持平滑
3. 在 1k+ blocks 规模下，Chat 仍可滚动与输入

---

## 10. 当前代码结构与推荐边界

## 10.1 当前主要文件

Chat 模块当前主要边界：

1. `apps/web/src/modules/chat/components/chat-panel.tsx`
2. `apps/web/src/modules/chat/components/chat-stream.tsx`
3. `apps/web/src/modules/chat/components/chat-message.tsx`
4. `apps/web/src/modules/chat/components/chat-command-group.tsx`
5. `apps/web/src/modules/chat/components/chat-execution-block.tsx`
6. `apps/web/src/modules/chat/components/chat-event.tsx`
7. `apps/web/src/modules/chat/components/chat-interaction.tsx`
8. `apps/web/src/modules/chat/mappers/to-conversation-blocks.ts`
9. `apps/web/src/modules/tasks/store/tasks-session.selectors.ts`

## 10.2 推荐职责划分

### `chat-panel.tsx`

职责：

1. page-level orchestration
2. task detail / event stream / mutation hooks
3. message window state
4. follow-up submit logic

不应承担：

1. 具体消息块视觉实现
2. 大量文案格式化逻辑

### `chat-stream.tsx`

职责：

1. block renderer switch
2. block list rhythm

不应承担：

1. 复杂业务判断

### `chat-message.tsx`

职责：

1. user / assistant 主消息显示
2. markdown rendering
3. 消息视觉优先级

### `chat-command-group.tsx`

职责：

1. 命令日志折叠与摘要

### `chat-execution-block.tsx`

职责：

1. tool / search / file change 摘要
2. 右侧 drawer 入口

### `chat-interaction.tsx`

职责：

1. 统一 composer shell
2. 文本、粘贴、拖拽、发送交互

---

## 11. UI 迭代优先级

## Phase 1：基础体验成型

1. Header 完整化
2. user / assistant 消息层级拉开
3. Composer 统一风格
4. typing / running 过渡更自然

## Phase 2：执行轨迹降噪

1. command-group 默认折叠 output
2. execution block 摘要化
3. event 弱化

## Phase 3：长会话优化

1. 增量物化
2. 更强的窗口化 / 虚拟化
3. 时间分段
4. 历史加载提示优化

## Phase 4：高级体验

1. assistant 长消息展开/收起
2. richer status summaries
3. 更强的可访问性与键盘导航

---

## 12. 验收标准

当 Chat 满足以下条件时，可认为进入“可长期使用”的前端状态：

1. 用户能快速区分主回复与辅助轨迹
2. 用户能明确知道 agent 当前是否在工作、做到了哪一步
3. 输入区支持文本与图片上下文，且反馈明确
4. 长会话下滚动与输入仍保持流畅
5. Chat UI 不像日志控制台，也不像普通 IM，而是明显体现“AI coding workbench”定位

---

## 13. 当前结论

Harbor 的 Chat 应当朝以下方向演进：

1. **assistant-first**
   - 让 assistant 回复成为最重要信息层

2. **trace-visible but quiet**
   - 执行轨迹必须可见，但要降噪

3. **composer as a work input**
   - 输入器既是 prompt 输入，也是上下文注入器

4. **performance by design**
   - 从结构上限制长会话成本，而不是等卡了再救火

5. **IDE-native feel**
   - Chat 要像项目工作台的一部分，不像外嵌聊天框
