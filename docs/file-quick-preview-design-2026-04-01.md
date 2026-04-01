# File Quick Preview 设计文档（2026-04-01）

## 1. 背景

当前前端在 `task` 聊天会话中，AI 会以两种方式暴露文件信息：

1. 通过结构化 `file_change` 事件表达“创建 / 修改 / 删除了哪些文件”
2. 通过 assistant message 在自然语言中提及某个文件路径

现在系统已经具备三类基础能力：

1. 项目级文件系统接口，支持读取文本文件与查询文件元信息
2. 聊天区域中的 Markdown 渲染组件
3. 右侧浮层基础组件与全局 UI 状态管理模式

因此可以将“在聊天上下文里快速查看文件内容”的需求，沉淀为一个全局可复用的 `file preview` 能力，而不是只在 `task` 模块里做一个临时特性。

## 2. 目标

本次设计目标如下：

1. 支持用户从聊天区域快速打开某个项目文件的只读预览
2. 预览面板以右侧抽屉 / 右侧 sheet 的形式打开，不打断当前会话上下文
3. 预览能力设计为全局模块，后续可被 `task`、`git diff`、`project files` 等多个入口复用
4. 文件内容读取统一走现有 `filesystem` 接口，不复用聊天事件中的非权威文本
5. Markdown 文件优先使用全局 Markdown 预览能力展示

## 3. 非目标

本期明确不做以下内容：

1. 不做文件编辑能力
2. 不做多文件并排预览
3. 不做完整 IDE 式文件浏览器
4. 不对 assistant 自然语言中的任意路径做激进自动识别
5. 不把所有文件类型都强制走 Markdown 渲染

## 4. 核心判断

### 4.1 这不是 `task chat` 私有能力，而是全局能力

需求虽然来自聊天场景，但“打开某个项目文件的快速预览”本质上是跨模块能力。

后续同样会在这些场景复用：

1. `task` 会话中的 `file_change` 卡片
2. assistant message 中的显式文件链接
3. `git diff` 列表中的某个文件
4. 未来的 project file explorer

因此不应继续沿用 `task-session` 内部 inspector 的建模方式来承载该能力。

### 4.2 结构化文件入口优先于自然语言推断

当前最稳定的入口并不是 assistant message 里的裸文本路径，而是结构化 `file_change` 事件。

原因如下：

1. 结构化事件已经明确给出 `path` 与 `kind`
2. 这些事件对应真实执行结果，语义更可靠
3. message 文本可能包含示例路径、伪代码路径、说明性路径，不能等同于实际存在的项目文件

因此第一阶段应优先支持：

1. 从 `file_change` block 点击进入预览
2. 从后续补充的显式文件卡片 / 链接进入预览

而不是一开始就对 assistant Markdown 文本做任意路径自动识别。

### 4.3 Markdown Preview 应继续作为全局组件，而不是“迁入全局模块”

当前 `MarkdownRenderer` 已经位于全局可复用位置，因此不存在“还需要再搬到全局模块”的问题。

正确的判断应当是：

1. 继续复用现有全局 Markdown 组件
2. 在新的 file preview 模块里按文件类型决定是否使用该组件
3. 不把 file preview 能力和 Markdown 能力耦合成同一个模块

一句话收敛：

```text
MarkdownRenderer 是全局基础渲染能力，File Preview 是全局业务能力。
```

## 5. 现状约束

### 5.1 已有后端接口

项目级文件系统已经提供以下能力：

1. `GET /v1/projects/:projectId/files/stat`
2. `GET /v1/projects/:projectId/files/text`
3. `POST /v1/projects/:projectId/files/list`

这意味着 quick preview 不需要新增后端协议即可起步。

### 5.2 已有前端基础组件

前端已经具备：

1. 通用 `Sheet` 组件，可直接承载右侧预览面板
2. 全局 `MarkdownRenderer`
3. `zustand` 全局 UI store 模式
4. 根布局挂载全局弹层的实践

### 5.3 当前 task 内已有局部详情抽屉

当前 `task-session` 里已有 `ChatDetailDrawer`，但它的职责是查看聊天事件详情，不适合直接扩展为全局文件预览容器。

原因如下：

1. 它的状态归属于 `task-session store`
2. 它绑定的是 inspector block，而不是独立资源标识
3. 它只能在当前 task 会话上下文内工作

## 6. 方案概述

### 6.1 模块边界

新增前端全局模块：`modules/file-preview`

建议目录：

```text
apps/web/src/modules/file-preview/
  api/
    file-preview-api.ts
  components/
    file-preview-sheet.tsx
    file-preview-content.tsx
  hooks/
    use-file-preview.ts
  lib/
    file-preview-type.ts
  store/
    file-preview.store.ts
  index.ts
```

职责划分如下：

1. `api`：封装 `stat` 与 `read text file` 请求
2. `store`：维护当前打开文件的全局预览状态
3. `components`：右侧预览面板与内容区
4. `hooks`：暴露统一的打开 / 关闭行为
5. `lib`：文件类型判断、预览模式选择、尺寸阈值策略

### 6.2 全局状态模型

建议不要继续把文件预览状态塞到 `task-session` 内，而是建立独立 store。

建议状态：

```ts
type FilePreviewState = {
  open: boolean
  projectId: string | null
  path: string | null
  source: "task-file-change" | "task-message-link" | "git-diff" | "unknown" | null
}
```

必要 action：

1. `openFilePreview(input)`
2. `closeFilePreview()`
3. `replaceFilePreview(input)`

后续如果要支持“返回上一个预览文件”或“最近打开记录”，再在此基础上扩展。

### 6.3 UI 载体

使用 `Sheet` 作为默认实现，而不是复用 `ChatDetailDrawer`。

原因如下：

1. 这是一个全局资源预览，不是移动端底部抽屉语义
2. `Sheet` 更适合固定右侧信息面板
3. 后续可在更多页面中共用，不依赖 `task-session`

挂载位置建议在应用根布局，与现有全局弹层并列。

### 6.4 数据读取策略

打开预览后，前端执行以下步骤：

1. 先调 `stat` 获取文件元信息
2. 判断该路径是否可预览、是否为文本文件、是否超过阈值
3. 可预览时再调 `files/text` 读取内容
4. 根据文件类型选择渲染方式

这样设计的原因：

1. 可以提前拒绝目录、二进制和超大文件
2. 能减少无意义的大文本加载
3. 可在 UI 上更清晰地表达“不可预览”的原因

## 7. 渲染策略

### 7.1 不同文件类型的展示模式

建议采用分层策略，而不是统一 Markdown：

1. `*.md` / `*.markdown`
   - 使用 `MarkdownRenderer`
2. 纯文本 / 代码文件，如 `ts`、`tsx`、`js`、`json`、`yml`、`yaml`、`css`、`html`
   - 使用只读文本预览
   - 首期可先展示 `pre` / `code`，后续再补语法高亮
3. 二进制文件或无法识别的文件
   - 显示“暂不支持预览”提示
4. 超大文件
   - 显示“文件过大，暂不在 quick preview 中加载”提示

### 7.2 为什么不能统一走 Markdown

如果把所有文件都丢给 Markdown 渲染，会产生以下问题：

1. 代码文件会被误解释为 Markdown 文本，阅读体验差
2. JSON / YAML 等结构化文本失去语义化展示
3. 不利于后续扩展代码高亮与行号能力

因此应将 Markdown 视为预览模式之一，而不是总入口。

## 8. 入口设计

### 8.1 第一阶段入口

第一阶段只接入稳定入口：

1. `file_change` block 中每个文件项提供 `Preview` 操作
2. 如果某个 block 只展示前三个文件，则在详情抽屉中也提供 `Preview` 操作

这样能以最小成本验证：

1. 全局模块边界是否合理
2. 用户是否真正需要快速预览，而不仅是查看路径
3. 文件读取性能与交互体验是否达标

### 8.2 第二阶段入口

在全局 preview 模块稳定后，再考虑：

1. assistant message 内的显式文件链接
2. `git diff` 文件列表中的“Open Preview”
3. 后续 file explorer 入口

### 8.3 关于 message 自动识别路径

不建议首期直接做 assistant 文本中的裸路径自动识别。

建议顺序如下：

1. 先支持结构化 `file_change`
2. 再支持 assistant 输出中的显式文件链接协议
3. 最后再评估是否需要对裸文本路径做弱识别

如果未来要支持 message 内点击文件，建议采用显式协议，例如：

```text
[src/app/page.tsx](harbor-file://project/{projectId}?path=src/app/page.tsx)
```

然后在 Markdown link renderer 中拦截该协议，而不是依赖正则猜测。

## 9. 交互细节

### 9.1 右侧面板建议信息结构

右侧文件预览面板建议包含：

1. 文件名
2. 相对路径
3. 文件类型 / 预览模式标签
4. 文件大小与修改时间
5. 主体预览区
6. 错误或降级提示区

可选次级动作：

1. `Copy path`
2. `Open in workspace`（未来如果产品有对应能力）
3. `Reload`

### 9.2 加载与异常状态

必须明确处理以下状态：

1. `loading`：正在读取文件
2. `success`：成功显示内容
3. `not-found`：文件已不存在
4. `unsupported`：文件类型不支持预览
5. `too-large`：文件过大
6. `error`：请求失败或解析失败

### 9.3 当文件被删除时

如果入口来自 `file_change` 且文件 `kind = delete`，默认不尝试读取文件正文。

此时应显示：

1. 该文件已被删除
2. 当前 quick preview 不提供历史版本回看

这比去请求一个注定失败的 `read text` 更清晰。

## 10. 模块归属建议

### 10.1 前端归属

建议新增 `modules/file-preview`，不要放在：

1. `modules/tasks`
2. `components/markdown`
3. `stores/ui.store.ts`

原因如下：

1. `modules/tasks` 过于场景化
2. `components/markdown` 是基础渲染层，不应承载业务流程
3. `ui.store.ts` 当前只适合存少量全局 UI 开关，不适合承载带资源语义的业务状态

### 10.2 Markdown 组件归属

`MarkdownRenderer` 保持在当前全局位置即可。

无需新增“全局 markdown preview 模块”。

如果后续确实出现更多 Markdown 预览场景，可以在 `components/markdown` 下继续演进，例如：

1. `MarkdownRenderer`
2. `MarkdownPreviewPane`
3. `MarkdownLinkInterceptor`

但它们仍应是基础展示能力，而不是文件预览业务模块本身。

## 11. 分阶段实施建议

### Phase 1：最小可用版本

目标：先把全局 file preview 能力跑通。

范围：

1. 新增 `modules/file-preview`
2. 新增全局 `FilePreviewSheet`
3. 接入项目级 `stat` 与 `read text file`
4. 只支持从 `file_change` block 打开
5. 支持 Markdown 与纯文本两种预览模式
6. 明确处理 deleted / too-large / unsupported 状态

### Phase 2：多入口复用

目标：验证全局模块复用价值。

范围：

1. 接入 `git diff` 文件列表
2. 接入 `task` 详情抽屉中的文件项
3. 支持 `copy path`
4. 支持 `reload`

### Phase 3：显式文件链接

目标：让 assistant message 也能可靠触发预览。

范围：

1. 设计显式文件链接协议
2. 在 Markdown link 渲染器中拦截
3. 打通 assistant 输出到前端链接行为

## 12. 风险与取舍

### 12.1 风险一：把能力直接做进 task-session

短期看开发更快，但会导致：

1. 能力无法被其他页面复用
2. 状态与 task 生命周期耦合过深
3. 后续迁移成本更高

因此不建议。

### 12.2 风险二：一开始就做 message 路径自动识别

会导致：

1. 错误命中率高
2. UI 行为不可预期
3. assistant 文本格式被前端隐式绑定

因此不建议作为第一阶段能力。

### 12.3 风险三：把所有预览都交给 Markdown

会导致：

1. 文本 / 代码文件展示体验差
2. 后续扩展代码高亮困难
3. 组件职责混乱

因此应按文件类型分流。

## 13. 验收标准

满足以下条件即可认为第一阶段完成：

1. 用户可从 `task` 聊天中的 `file_change` 项点击打开文件预览
2. 右侧以全局 sheet 形式展示文件内容
3. 文件内容读取统一走项目级 `filesystem` 接口
4. Markdown 文件正确渲染
5. 纯文本 / 代码文件以只读文本方式展示
6. 删除文件、超大文件、二进制文件有明确降级提示
7. 该能力不依赖 `task-session` 私有 store 才能工作

## 14. 最终结论

本需求应被正式定义为：

```text
面向全局的项目文件快速预览能力，聊天场景只是第一批入口之一。
```

最终决策如下：

1. 做成全局 `file preview` 模块
2. 文件内容统一走 `filesystem` 接口读取
3. 使用右侧 `Sheet` 作为预览容器
4. 复用现有全局 `MarkdownRenderer`，但不把所有文件都当成 Markdown
5. 第一阶段只接结构化稳定入口，不做激进 message 路径自动识别

这套方案既能满足当前需求，也能为后续 `git`、`file explorer`、assistant 显式文件链接等场景提供统一能力底座。
