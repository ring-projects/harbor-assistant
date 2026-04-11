# Chat Visual Style Guardrails

## 1. 文档信息

- 文档名称：Chat Visual Style Guardrails
- 日期：2026-03-29
- 状态：Accepted
- 适用范围：
  - `apps/web/src/modules/tasks/features/task-session`
  - `apps/web/src/modules/tasks/view-models`
  - `apps/web/src/components/ui`
  - `apps/web/src/app/globals.css`
- 关联文档：
  - [frd-chat-frontend.md](./frd-chat-frontend.md)
  - [product-prd-2026-04-10.md](./product-prd-2026-04-10.md)
  - [task-api.md](./task-api.md)
  - [frontend-testing.md](./frontend-testing.md)

## 2. 目的

本文档不是重新定义 chat 的信息架构，而是把当前已经形成的前端视觉风格明确沉淀下来，作为后续迭代的视觉 guardrail。

目标只有三个：

1. 明确当前 agent chat 的 canonical 视觉气质
2. 防止后续开发为了“更炫”或“更像通用聊天产品”而把 UI 做廉价
3. 给新增 block、状态和交互提供统一的审美约束

如果后续需求与本文档冲突，应优先判断是否真的在改善信息层级与工作效率；如果只是增加装饰性或让界面更像消费级聊天产品，则默认不应采纳。

## 3. 当前风格的 canonical 定义

Harbor 当前的 agent chat 应定义为：

**开发者工作台语义下的 agent 会话面板（developer workbench style agent console）**

它不是：

1. 通用 IM 聊天窗
2. 社交产品消息列表
3. 营销化 AI 助手落地页对话框

它应该同时呈现：

1. 用户输入
2. assistant 主回复
3. command / tool / search / file change / todo / event 等执行轨迹

因此，它的视觉核心不是“聊天气泡感”，而是：

1. **工作流感**
2. **结构化信息感**
3. **可审计执行轨迹感**
4. **克制而耐看的工具界面感**

## 4. 风格关键词

后续设计评审应默认用以下关键词校验是否跑偏：

1. 低饱和
2. 克制
3. 工具化
4. 开发者友好
5. 信息分层明确
6. 长时间使用不累
7. 优先内容，不优先装饰

更具体地说，当前风格更接近：

1. IDE / terminal / ops dashboard
2. Linear / Cursor / DevTools 风格的工作界面

而不是：

1. 气泡感很重的即时通讯 UI
2. 颜色和装饰强烈的 marketing UI
3. 大量卡通图标、头像、渐变和情绪化元素的 AI 聊天 UI

## 5. 必须保留的视觉原则

### 5.1 信息层级优先于装饰层级

chat 的首要任务是让用户读懂：

1. 我说了什么
2. assistant 回了什么
3. agent 刚才执行了什么
4. 还有哪些细节可以下钻查看

因此视觉层级必须长期保持：

1. assistant message 是主内容
2. user message 是输入回执
3. typing / running 是过程提示
4. command / tool / file-change / search / todo 是辅助证据
5. passive event 是最低优先级背景信息

任何让低优先级 block 抢走主消息注意力的改动，都应视为退化。

### 5.2 使用低饱和 token，而不是廉价强调色堆砌

当前风格基于全局 token 和 OKLCH 颜色体系，主色、边框、背景、muted 区分都比较克制。

后续演进必须遵守：

1. 优先使用现有 `background / card / muted / accent / border / primary / destructive` token
2. 优先通过明度、透明度、边框和排版拉开层级
3. 谨慎使用高饱和成功色、警告色、错误色
4. 状态色只应用于状态表达，不应用作大面积装饰面

### 5.3 monospace 是工作台语义的一部分，不是可有可无的点缀

当前实现中，meta、状态、命令、事件、用户输入、附件等大量使用 monospace，这是整体气质的重要组成部分。

后续应继续保持：

1. assistant 正文可以使用 sans，提高长文可读性
2. 用户输入、时间、状态、命令、技术元信息优先使用 monospace
3. 不要把所有信息都改成一致的通用正文排版

如果把技术 meta 全部改成普通正文风格，界面会迅速失去“agent console”的辨识度。

### 5.4 message 与 system block 必须有视觉语义差异

当前实现里，`message`、`command-group`、`file-change`、`web-search`、`mcp-tool-call`、`todo-list`、`event` 已经形成两套视觉语言：

1. message 是主交流内容
2. system block 是执行轨迹卡片

后续不应把所有 block 做成同一种消息气泡，也不应把所有内容都做成同一种卡片。

否则会出现两种退化：

1. 会话失去主次关系
2. 工具行为失去可扫描性

### 5.5 第一屏摘要 + 二级下钻 是必须保留的交互策略

当前样式不是把所有 payload 一次性摊平，而是：

1. 在流里展示摘要
2. 通过 drawer 看细节

这套策略必须保留，因为它同时服务于：

1. 长会话可读性
2. 首屏扫描效率
3. 对复杂执行信息的容纳能力

## 6. 分区风格规范

### 6.1 面板与布局

chat 面板应保持工作区布局，而不是沉浸式大气泡布局：

1. 顶部标题区保持简洁，不叠加无关装饰
2. 中间会话区保持稳定滚动语义
3. 底部 composer 独立成一个轻量工作输入区

不应加入：

1. 巨大欢迎 banner
2. 装饰性 hero 区块
3. 与 task 内容无关的品牌插画

### 6.2 主消息区

主消息区应遵守：

1. assistant 消息优先保障长文阅读体验
2. user 消息更像输入回执，保持紧凑
3. 背景色差异要轻，不要做高对比聊天气泡对撞
4. markdown、代码块、表格、引用的样式服务于内容，不服务于视觉噱头

允许的优化包括：

1. 更好的段落节奏
2. 更稳定的代码块视觉层级
3. 更好的表格和列表可读性

不允许的退化包括：

1. 过度圆角的大号聊天泡泡
2. 厚重阴影
3. 高饱和用户/assistant 对撞配色
4. 为了“更像聊天”而削弱 markdown 可读性

### 6.3 执行轨迹 block

command、tool、file change、web search、todo、event 应继续保持“辅助证据卡片”定位。

要求：

1. 默认展示摘要，而不是完整原始内容
2. 状态明确，但不要比 assistant 正文更抢眼
3. 保持统一的 block 节奏、间距、字体和状态标签逻辑
4. 同类 block 之间可以有细微差异，但整体必须属于同一家族

### 6.4 输入区 composer

composer 应继续体现“工作输入器”而不是“普通发消息框”：

1. 支持长文本输入
2. 支持附件、粘贴、拖拽
3. 支持发送与 stop current turn 两种主动作
4. helper text、错误提示、附件 chip 统一保持轻量技术感

不应演进为：

1. 富文本编辑器式工具条堆叠
2. 过多彩色 chip
3. 情绪化发送按钮或过度动画

### 6.5 详情抽屉

detail drawer 的角色是“技术明细视图”，不是另一个视觉主舞台。

要求：

1. section 标题简洁
2. raw payload / arguments / result / output 使用稳定技术排版
3. 保持复制、查看、核对的实用性优先

## 7. 明确禁止的廉价化方向

以下变化默认视为破坏当前风格，除非有非常强的产品理由：

1. 用大面积渐变、发光、高饱和色块包装消息或系统 block
2. 给 user / assistant 引入夸张头像、角色拟人化插图、情绪化装饰
3. 把所有内容都做成统一“圆润聊天气泡”
4. 让 command / tool / file change / search 变成与主消息同等吸睛的主卡片
5. 大量使用彩色 badge、彩色边框、彩色图标，把状态提示变成装饰
6. 为了“更热闹”而增加无业务意义的动画
7. 把技术 meta 放大成正文级字号
8. 弱化 monospace、弱化时间与状态层级、弱化执行轨迹的结构化感
9. 用营销化文案替代当前偏工具化、可操作的交互提示

## 8. 允许且鼓励的升级方向

本文档的目的是防止廉价化，不是禁止优化。以下方向鼓励继续做：

1. 在不改变气质的前提下，进一步统一间距、圆角和 block 节奏
2. 让 assistant 正文更好读，尤其是长文、代码、表格、引用
3. 让 system block 的摘要信息更清楚、更稳定
4. 让 running / typing / pending 的过程态更自然
5. 让 hover / focus / selected / open 状态更精确
6. 让亮暗主题下的层级关系更稳定
7. 让大消息量时的滚动、窗口裁剪和视觉连续性更好

换句话说：

**可以变得更精致，但不要变得更便宜。**

## 9. 新增 UI 时的审查清单

以后新增 block、状态、按钮、详情视图时，PR 至少要自问以下问题：

1. 这个改动是在增强信息层级，还是只是在增加视觉刺激？
2. 它是否仍然属于“developer workbench”而不是“消费级聊天产品”？
3. assistant 主回复是否仍然是视觉中心？
4. 新增颜色是否真的服务于状态语义？
5. 是否保留了摘要优先、细节下钻的交互策略？
6. 是否延续了 mono meta + sans 正文 的组合逻辑？
7. 长时间使用时，这个设计是否仍然耐看、耐扫、耐读？

如果其中任一问题答案明显偏负面，应先回退设计，再讨论实现。

## 10. 当前实现参考点

以下实现可以视为当前风格的主要参考源：

1. `apps/web/src/modules/tasks/features/task-session/components/task-session-panel.tsx`
2. `apps/web/src/modules/tasks/features/task-session/components/task-session-conversation-pane.tsx`
3. `apps/web/src/modules/tasks/features/task-session/composer/chat-interaction.tsx`
4. `apps/web/src/modules/tasks/features/task-session/composer/task-input-attachment-list.tsx`
5. `apps/web/src/modules/tasks/features/task-session/conversation/chat-message.tsx`
6. `apps/web/src/modules/tasks/features/task-session/conversation/chat-message.module.css`
7. `apps/web/src/modules/tasks/features/task-session/conversation/chat-command-group.tsx`
8. `apps/web/src/modules/tasks/features/task-session/conversation/chat-file-change-block.tsx`
9. `apps/web/src/modules/tasks/features/task-session/conversation/chat-mcp-tool-call-block.tsx`
10. `apps/web/src/modules/tasks/features/task-session/conversation/chat-web-search-block.tsx`
11. `apps/web/src/modules/tasks/features/task-session/conversation/chat-todo-list-block.tsx`
12. `apps/web/src/modules/tasks/features/task-session/conversation/chat-event.tsx`
13. `apps/web/src/modules/tasks/features/task-session/components/chat-detail-drawer.tsx`
14. `apps/web/src/app/globals.css`

后续如果这些实现发生系统性调整，应同步更新本文档，而不是让文档与实现长期漂移。
