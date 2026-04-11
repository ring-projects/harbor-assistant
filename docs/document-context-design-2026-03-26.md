# Document Context Design

## 1. 文档信息

- 文档名称：Document Context Design
- 日期：2026-03-26
- 状态：Proposed Canonical Design
- 适用范围：
  - future `document` module
  - project-local knowledge workspace 内的知识文档管理
  - `task` / future `orchestration` 对文档能力的依赖边界
- 关联文档：
  - [./project-local-knowledge-workspace-design-2026-03-26.md](./project-local-knowledge-workspace-design-2026-03-26.md)
  - [./project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
  - [./orchestration-requirements-2026-03-31.md](./orchestration-requirements-2026-03-31.md)
  - [./service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
  - [./archive/features/swarm-orchestration-capability-archive-2026-03-26.md](./archive/features/swarm-orchestration-capability-archive-2026-03-26.md)

## 2. 文档目标

这份文档只解决 `document` context 的设计，不试图一步到位重写 swarm / orchestration。

它要回答的问题只有六个：

1. `Document` 到底是什么
2. 为什么它应该是单独的 context，而不是 task 的附属字段
3. `Document` 与 `project / task / execution` 的关系应该如何表达
4. 文件系统正文与 service 元数据之间如何划分 source of truth
5. `document` context 应暴露哪些基础能力
6. 第一阶段应刻意不做哪些事情

## 3. 设计前提

本设计采用以下前提：

1. 知识协作内容应 document-first
2. 文档正文应保持 file-first，并对 agent 可见
3. `task / execution` 等控制状态不应并入 `Document`
4. `document` 是知识上下文，不是 workflow engine
5. `document` 提供基础 primitive，strategy 由 skill 或 future orchestration 负责
6. service 负责文档 identity、索引、关联、版本元数据，不维护第二份正文真相

一句话收敛：

```text
Document owns knowledge objects.
Task owns work units.
Execution owns runtime lifecycle.
```

## 4. 为什么需要单独的 `document` context

如果没有单独的 `document` context，系统里的知识内容通常会退化到三个位置：

1. `task.prompt`
2. runtime event payload
3. 零散的数据库 blob / json 字段

这种做法的问题很明确：

1. 知识无法被稳定引用
2. agent 不能自然读取和复用
3. 用户很难直接审阅中间产物
4. 子任务上下文很难显式构造
5. 汇总任务只能重新解析历史，而不是消费稳定对象

因此需要一个独立上下文来承载：

1. requirements
2. plan
3. context bundle
4. task summary
5. review
6. final report

## 5. `document` context 的职责边界

### 5.1 它负责什么

`document` context 负责以下业务真相：

1. 文档 identity
2. 文档 kind
3. 文档路径约定
4. 文档与 project / task 的关联
5. 文档版本元数据
6. 文档状态
7. 文档读写能力
8. 文档索引与查询能力

### 5.2 它不负责什么

`document` context 不负责：

1. task lifecycle
2. execution lifecycle
3. provider runtime
4. websocket delivery
5. orchestration fan-out / join / barrier
6. Git 存储与提交策略
7. 文档内容的“正确性判断”

尤其要避免两种退化：

1. 把 `document` 做成任意文件系统 wrapper
2. 把 `document` 做成 workflow state machine 的替身

## 6. 核心模型

### 6.1 Aggregate Root

第一版建议把 `Document` 视为 `document` context 的 aggregate root。

推荐领域表达：

```ts
Document {
  id: string
  projectId: string
  taskId: string | null
  kind: "requirements" | "plan" | "context_bundle" | "task_summary" | "review" | "final_report"
  title: string
  path: string
  format: "markdown" | "json"
  status: "draft" | "published" | "archived"
  version: number
  summary: string | null
  createdAt: string
  updatedAt: string
}
```

这里最关键的是：

1. 正文不在聚合字段里直接持有
2. 聚合管理的是身份、关联、路径、版本与状态
3. 真正的正文内容来自 file-first knowledge workspace

### 6.2 为什么不把正文直接放进聚合

因为本文档采用的 source-of-truth 策略是：

1. 正文 file-first
2. 元数据 db-first

如果把完整正文复制到聚合里，就会立即出现双写真相问题。

### 6.3 可选的派生关系

第一版可以只做最小关系。

如果后续确实需要更强追溯能力，可以考虑增加：

1. `derivedFromDocumentId`
2. `sourceExecutionId`

但这两个字段不建议在第一阶段就强上。

## 7. 文档类型设计

第一版建议只支持稳定、少量、业务明确的 document kinds：

1. `requirements`
2. `plan`
3. `context_bundle`
4. `task_summary`
5. `review`
6. `final_report`

这些类型有足够的表达力，同时不会过早开放为“任意文档类型注册系统”。

### 7.1 `requirements`

用于记录需求分析结果、目标、约束、验收标准。

### 7.2 `plan`

用于记录实施计划、拆分步骤、分工建议。

### 7.3 `context_bundle`

用于给 sub task 提供完整但有边界的上下文。

### 7.4 `task_summary`

用于记录某个 task 的阶段输出或终局输出摘要。

### 7.5 `review`

用于记录对结果的评审结论、风险、改进项。

### 7.6 `final_report`

用于记录最终综合输出。

## 8. `Document` 与其他 context 的关系

### 8.1 与 `project` 的关系

每个 `Document` 必须属于一个存在的 `Project`。

`project` 提供：

1. `rootPath`
2. project identity
3. project-local `.harbor` workspace 的根路径语义

但 `project` 不拥有文档正文。

### 8.2 与 `task` 的关系

`Document` 可以与 `Task` 关联，但它不是 `Task` 的内嵌 owned record。

推荐关系是：

1. 一个 task 可以关联多个 document
2. 一个 document 最多指向一个主要 task
3. task 通过引用消费 document
4. task 不把 document 正文塞进聚合字段

### 8.3 与 `execution` 的关系

第一版不要求 `Document` 必须和 `Execution` 强绑定。

原因是：

1. 同一个 task 可能多次续跑
2. 同一份需求或计划未必属于某个单独 execution 片段
3. 过早把 `Document` 绑定 execution，会把知识对象误建模成 runtime 附件

如果后续需要审计溯源，再通过元数据补关系即可。

## 9. Source of Truth 设计

### 9.1 正文存储

正文存储在：

```text
{PROJECT_ROOT}/.harbor
```

推荐以 `markdown` 和 `json` 为第一阶段唯一正文格式。

### 9.2 元数据存储

service 负责持久化：

1. `id`
2. `projectId`
3. `taskId`
4. `kind`
5. `title`
6. `path`
7. `format`
8. `status`
9. `version`
10. `summary`
11. `createdAt`
12. `updatedAt`

### 9.3 为什么要保留元数据存储

因为系统仍需要：

1. 列出一个 project 的所有 requirements
2. 查找某个 task 的所有 summaries
3. 按 kind 查询文档
4. 按版本和更新时间做索引
5. 记录明确的关联关系

这些能力不适合完全靠扫描文件系统实现。

## 10. 路径与目录约定

建议沿用 project-local knowledge workspace 的目录约定：

```text
{PROJECT_ROOT}/.harbor/
  docs/
    requirements/
    plans/
    reviews/
    summaries/
    bundles/
  tasks/
    {taskId}/
      inputs/
      outputs/
  manifest.json
```

### 10.1 推荐 path 规则

建议不同 `kind` 对应固定目录：

1. `requirements` -> `docs/requirements/`
2. `plan` -> `docs/plans/`
3. `review` -> `docs/reviews/`
4. `task_summary` -> `docs/summaries/`
5. `context_bundle` -> `docs/bundles/`
6. `final_report` -> `docs/summaries/` 或单独目录，第一版可先复用 summaries

### 10.2 文件命名

第一版建议文件名稳定而可读，例如：

```text
requirements-{documentId}.md
plan-{documentId}.md
bundle-{documentId}.json
summary-{documentId}.md
```

不要把 title 直接作为文件名真相，以避免重命名带来的路径震荡。

## 11. 核心不变量

`Document` 至少应维护以下不变量：

1. document 必须属于一个存在的 project
2. `path` 必须位于该 project 的 `.harbor` workspace 内
3. `kind` 与目录约定必须一致
4. `version` 只能递增
5. archived document 不能被当作活动文档继续写入
6. 同一 `id` 只对应一个 canonical path

## 12. 对外能力设计

第一阶段建议 `document` context 只暴露基础 primitive：

1. `createDocument`
2. `getDocument`
3. `readDocumentContent`
4. `updateDocumentContent`
5. `publishDocument`
6. `archiveDocument`
7. `listProjectDocuments`
8. `listTaskDocuments`

如果需要一个稍强能力，建议补：

9. `forkDocument`

它适合“从 requirements 派生 plan”或“从 summary 派生 review”。

## 13. 与 skill / orchestration 的协作方式

### 13.1 Skill 应如何使用 `document`

skill 更适合：

1. 创建需求文档
2. 基于需求文档生成计划
3. 从需求和计划生成多个 `context_bundle`
4. 从多个 task summary 生成 review / final report

### 13.2 future orchestration 应如何使用 `document`

如果未来存在 orchestration，它应把 `document` 当作基础能力来消费，而不是把 `document` 内嵌成 orchestration 私有实现。

也就是说：

1. orchestration 读取 document
2. orchestration 生成 document
3. orchestration 不拥有 document source of truth

## 14. 第一阶段不建议做的事

第一阶段不建议立即实现：

1. 二进制文档资产
2. 富文本编辑模型
3. 文档权限系统
4. 跨 project 共享文档
5. 文档模板 DSL
6. 可插拔 kind registry
7. execution 级强绑定文档模型
8. 自动 Git 提交策略

## 15. 推荐的实现顺序

如果按 TDD 推进，我建议顺序如下：

1. 先锁定 `Document` 聚合和不变量
2. 再做 `create / update / publish / archive` use case
3. 再做 project / task scoped query
4. 再做 file system + metadata repository 映射
5. 最后再让 `task` 或 future orchestration 消费它

## 16. 最终结论

`document` 应该被建模为一个独立的知识上下文，而不是 `task` 的附属字段，也不是一个任意文件系统工具库。

它的本质是：

1. 为 agent 和用户提供可见、可引用、可版本化的知识对象
2. 让知识协作从隐式 prompt 传递，提升为显式系统对象
3. 作为未来 `context_bundle`、sub task 分发和汇总 resume 的基础 primitive

一句话总结：

```text
Document is the knowledge primitive.
It should stay simple, visible, and composable.
```
