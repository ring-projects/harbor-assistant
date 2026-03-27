# Chat 长会话性能优化方案（2026-03-27）

## 1. 背景

在 Harbor 当前实现中，Chat 在对话增多后会出现明显性能退化，主要表现为：

1. 流式输出期间 UI 卡顿、掉帧
2. 输入框打字时消息列表跟着抖动或变慢
3. 长消息、代码块、命令输出增多后滚动和展开明显变重
4. 对话越长，每个新事件到来后的卡顿越明显

该问题已经在 `docs/frd-chat-frontend.md` 中被识别为长期风险，但尚未落到关键路径治理上。

---

## 2. 当前根因总结

### 2.1 数据层是“全量重算”而不是“增量追加”

前端每收到一个新的 task event，都会：

1. 将历史 `current.items` 与新 `incoming.items` 重新合并
2. 全量重新排序
3. 重新生成新的 stream 引用
4. 再从头把所有 events 投影成 conversation blocks

这意味着随着历史增长，单次更新成本持续上升。

关键位置：

- `apps/web/src/modules/tasks/store/task-event-stream.utils.ts`
- `apps/web/src/modules/tasks/domain/store/task-session.selectors.ts`
- `apps/web/src/modules/tasks/features/task-session/mappers/to-conversation-blocks.ts`

### 2.2 UI 只裁掉了 DOM，没有裁掉计算

当前 `TaskSessionPanel` 虽然只展示尾部窗口，但窗口裁剪发生在 `toConversationBlocks(events)` 之后。

也就是说：

1. 隐藏的旧消息仍然参与每次全量投影
2. command group / tool block / event block 仍然每次重建
3. 真正节省的主要是 DOM 数量，而不是 CPU 计算成本

关键位置：

- `apps/web/src/modules/tasks/features/task-session/components/task-session-panel.tsx`

### 2.3 状态订阅边界过大，输入与滚动会牵动消息流重渲染

当前 `TaskSessionPanel` 同时订阅：

1. detail
2. blocks
3. chatUi（含 draft / stickToBottom / pendingPrompt / selectedInspectorBlockId）
4. selectedInspectorBlock
5. lastSequence

导致：

1. 输入框每敲一个字，父组件 rerender
2. 滚动时 `stickToBottom` 变化，父组件 rerender
3. 打开详情抽屉，也会影响主面板 rerender

### 2.4 assistant message 渲染成本高

assistant 消息每次 render 会重新执行：

1. Markdown 解析
2. 代码块识别
3. Shiki 高亮 effect 调度

当长消息、代码块数量增多时，成本会被进一步放大。

关键位置：

- `apps/web/src/modules/tasks/features/task-session/conversation/chat-message.tsx`
- `apps/web/src/components/code/ShikiCodeBlock.tsx`

### 2.5 命令输出存在额外字符串累积成本

`command.output` 目前通过字符串不断拼接得到，而该拼接又发生在每次全量 block projection 时，长输出场景下非常容易放大卡顿。

---

## 3. 优化目标

### 3.1 短期目标

1. 输入框输入不再触发整个消息流区域重渲染
2. 滚动状态变化尽量不触发消息块重绘
3. 未变化的消息块尽量复用，不重复 Markdown/render
4. 不改变现有行为与展示结果

### 3.2 中期目标

1. 将 conversation block 从“全量投影”改为“增量投影”
2. 将 event stream 从“全量 merge + sort”改为“优先 append，仅在必要时去重”
3. 将长命令输出改为懒处理 / 延迟展开

### 3.3 长期目标

1. 真正的消息虚拟列表
2. assistant message 的结构化缓存 / 预处理
3. 更稳定的 streaming 滚动策略

---

## 4. 分阶段实施策略

## Phase 1：低风险渲染隔离

目标：先解决最明显、最稳定的无关重渲染问题，不改数据模型。

实施项：

1. 拆分 `TaskSessionPanel`，把消息流区域、输入区、详情抽屉订阅边界隔离
2. 让 composer 只订阅 `draft` 和提交相关状态
3. 让消息流只订阅 `blocks`、滚动状态与 inspector 打开动作
4. 对 `ChatStream` / `ChatMessage` 等做 `React.memo`

验收标准：

1. 输入框输入时，消息流区域不整体重渲染
2. 打开抽屉不导致所有 message block 重渲染
3. 现有功能保持不变

风险：低。

---

## Phase 2：事件流合并优化

目标：降低每个新 event 到来时的全量 merge/sort 成本。

实施项：

1. 优化 `mergeTaskAgentEvent`
2. 在 sequence 单调递增、id 不重复的常见路径下直接 append
3. 只在 snapshot 合并或乱序场景下回退到去重 merge

验收标准：

1. 单个 streaming event 的处理复杂度显著下降
2. 历史消息增长后，新增 event 的处理时间不明显线性放大

风险：中低，需要保证去重与乱序安全。

---

## Phase 3：conversation blocks 增量投影

目标：避免每次都从头把所有 events 投影为 blocks。

实施项：

1. 在 store 中引入 block projection cache / derived state
2. 针对 message / tool / command group 做增量更新
3. command group 改为可增量修补而非全量重建

验收标准：

1. 新 event 到来时只处理受影响 block
2. 历史 blocks 不再随每次 streaming 被完整重建

风险：中，需要仔细保证 block 语义一致性。

---

## Phase 4：长内容渲染与滚动治理

目标：降低 Markdown / code block / smooth scroll 带来的额外负担。

实施项：

1. assistant message 做更稳定的 memo/caching
2. 长命令输出默认仅显示摘要和尾部预览
3. streaming 状态下减少 `smooth` 滚动触发频率
4. 必要时为消息流接入虚拟列表

验收标准：

1. 长 markdown、长 code block、长 command output 场景明显更流畅
2. 滚动行为更稳定，减少布局抖动

风险：中。

---

## 5. 本次执行顺序

本轮先做以下两件事：

1. 先落本文档，作为后续修复依据
2. 立即开始 Phase 1，仅处理低风险渲染隔离

Phase 1 完成后，再继续推进：

1. event stream append 优化
2. block projection 增量化

---

## 6. 验证方式

每个阶段完成后，至少执行：

1. 相关单测
2. web typecheck / lint（至少与改动相关）
3. 人工检查以下场景：
   - 普通消息流
   - running / typing
   - command output
   - inspector drawer
   - draft 输入与 resume 交互

---

## 7. 不在本轮直接处理的内容

为保证修复稳定性，本轮先不处理：

1. 服务端 task event projection 结构重构
2. Agent runtime resume 逻辑调整
3. Chat 视觉层级改版
4. 复杂虚拟滚动方案

这些内容留待后续阶段处理。
