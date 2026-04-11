# Project-Local Knowledge Workspace Design

## 1. 文档信息

- 文档名称：Project-Local Knowledge Workspace Design
- 日期：2026-03-26
- 状态：Proposed Canonical Design
- 适用范围：
  - future `document` / `knowledge workspace` capability
  - project root 下的 `.harbor` 目录约定
  - `task` / future `orchestration` 对知识文档的读写边界
- 关联文档：
  - [./project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
  - [./orchestration-requirements-2026-03-31.md](./orchestration-requirements-2026-03-31.md)
  - [./interaction-context-design-2026-03-24.md](./interaction-context-design-2026-03-24.md)
  - [./service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
  - [./project-local-skill-bridge.md](./project-local-skill-bridge.md)
  - [./archive/features/swarm-orchestration-capability-archive-2026-03-26.md](./archive/features/swarm-orchestration-capability-archive-2026-03-26.md)

## 2. 背景

随着系统从单一 task 执行走向更复杂的 agent 协作，单靠数据库字段和 runtime event 已经不足以承载真正的知识流转。

系统里逐渐出现一类稳定、可复用、可审阅、可传递的内容：

1. requirements
2. implementation plan
3. review summary
4. task output summary
5. context bundle
6. final report

这些内容本质上是文档，不是 task lifecycle 字段，也不是 execution control state。

如果继续把这类内容塞进以下位置：

1. task prompt
2. runtime event payload
3. 临时 route 内部拼接逻辑
4. 数据库 blob 字段

那么后果会很直接：

1. agent 看不到真实知识上下文
2. skill 难以组合与复用
3. 用户难以检查和修正文档
4. 后续 swarm / orchestration 的上下文分发会越来越脆弱

因此需要在 project 内引入一层显式、可见、可管理的知识工作区。

## 3. 核心判断

本设计采用以下判断作为前提：

1. project root 下的 `.harbor` 应被定义为 project-local knowledge workspace
2. knowledge workspace 主要承载文档、上下文包、输入输出材料等知识产物
3. knowledge workspace 不应承载 task / execution 的控制真相
4. 文档正文应优先 file-first，而控制状态应继续 db-first
5. service 负责管理知识对象的 identity、索引、关联与约束
6. agent / skill 可以直接读取 `.harbor` 中的知识文档

一句话收敛：

```text
Knowledge should be file-first and agent-visible.
Control should remain structured and database-first.
```

## 4. 设计目标

这份设计文档要解决的问题只有五个：

1. `{PROJECT_ROOT}/.harbor` 到底是什么
2. 它和 `~/.harbor` 之间如何分工
3. 哪些内容应该放到 project-local knowledge workspace
4. 哪些内容绝不应该放进去
5. 后续 `document` / `artifact` / `swarm` 设计应如何依赖它

## 5. 术语定义

### 5.1 Project-Local Knowledge Workspace

本文中的 Project-Local Knowledge Workspace 指：

```text
{PROJECT_ROOT}/.harbor
```

它是当前 project 的知识工作区，而不是 Harbor 的全局 home。

### 5.2 Harbor Global Home

本文中的 Harbor Global Home 指：

```text
~/.harbor
```

它用于全局配置、全局数据库、全局缓存以及 Harbor 持有的全局资源。

### 5.3 Knowledge Objects

本文中的 Knowledge Objects 指可被 agent 和用户共同读写、复查和复用的知识性产物，例如：

1. 文档
2. 上下文包
3. 输入附件清单
4. 输出摘要
5. 评审记录

## 6. 边界划分

### 6.1 `{PROJECT_ROOT}/.harbor` 负责什么

project-local `.harbor` 负责承载以下内容：

1. requirements 文档
2. implementation plan 文档
3. review 文档
4. task summary 文档
5. context bundle 文档
6. task 输入输出材料
7. knowledge manifest / index

这些内容有一个共同特点：

它们首先是知识产物，其次才是系统数据。

### 6.2 `{PROJECT_ROOT}/.harbor` 不负责什么

project-local `.harbor` 不负责：

1. task 真正的生命周期状态
2. execution 真正的生命周期状态
3. websocket session 状态
4. runtime recovery control
5. service 全局数据库
6. Harbor 全局配置
7. 跨 project 的全局知识真相

### 6.3 `~/.harbor` 负责什么

`~/.harbor` 继续负责：

1. 全局 app 配置
2. 全局 SQLite 数据库
3. Harbor 管理的全局缓存
4. Harbor 管理的全局 skill 资源
5. service 级运行时资源

### 6.4 真相划分原则

这里必须明确：

1. 文档正文是 file-first
2. task / execution 状态是 db-first
3. service 保存知识对象的索引、引用、关联和元数据
4. 不允许同一份知识正文同时在 DB 和文件系统中维护两个可写真相

一句话：

```text
正文在文件里，控制在数据库里，关联在 service 里。
```

## 7. 为什么这个方向成立

### 7.1 对 agent 更自然

如果知识文档直接存在 `.harbor` 下，agent 可以天然读取它们，而不需要每次都通过 service 重新组装 prompt。

这意味着：

1. skill 可以直接围绕文档工作
2. 上下文更透明
3. 知识流转不再完全依赖隐式 API 拼装

### 7.2 对用户更透明

用户可以直接查看：

1. 当前需求文档
2. 当前计划
3. 子任务上下文
4. 输出摘要
5. review 结果

这比把所有中间产物藏在数据库里更适合真实协作。

### 7.3 对 skill 组合更友好

如果未来强调通过 skill 组合系统能力，那么最稳定的输入不是内部 repository 接口，而是：

1. 明确的 capability surface
2. 明确的知识文档目录
3. 明确的文档 identity 和引用关系

这种结构天然更适合扩展。

## 8. 风险与反例

### 8.1 不要把 `.harbor` 做成系统垃圾桶

如果没有明确目录、命名和 manifest 约束，`.harbor` 很快会变成一个无结构的杂物堆。

### 8.2 不要让 `.harbor` 吞掉控制模型

如果以后把下列内容也塞进 `.harbor` 文档：

1. task 是否 completed
2. execution 是否 resumable
3. barrier 是否达成
4. resume 触发条件

那么系统将难以可靠自动化。

### 8.3 不要制造双写真相

如果数据库里有一份 summary，文件系统里也有一份 summary，而且两边都可写，那么很快就会失真。

因此必须坚持：

1. 正文 file-first
2. 元数据 / 索引 db-first
3. 两边不能都做正文主写点

### 8.4 不要默认把所有文档提交进 Git

`.harbor` 位于 project root，下列问题必须提前考虑：

1. Git 污染
2. 噪音 diff
3. 临时上下文意外入库
4. 评审材料混入业务仓库

默认策略应是：

1. `.harbor` 被忽略
2. 是否将某类文档导出到仓库，由显式动作决定

### 8.5 多 agent 并发写冲突

第一版要尽量避免多个 task 同时写同一文档。

更推荐的模式是：

1. 每个 task 写自己的输出文档
2. 汇总 task 再读取多个文档并生成新的汇总文档

## 9. 目录结构建议

第一版建议采用稳定且克制的目录结构：

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

### 9.1 `docs/`

按文档类型组织稳定知识对象：

1. `requirements/`
2. `plans/`
3. `reviews/`
4. `summaries/`
5. `bundles/`

### 9.2 `tasks/{taskId}/`

按 task 组织局部工作材料：

1. 原始输入材料
2. 中间输出材料
3. task 特定的上下文快照

### 9.3 `manifest.json`

`manifest.json` 只做索引与引用辅助，不做全部真相。

它至少可以记录：

1. 文档 ID
2. 文档路径
3. 文档类型
4. 关联 taskId
5. 关联 projectId
6. 当前版本号
7. 更新时间

## 10. 第一版文档类型建议

第一版不需要支持无限种文档类型，先收敛成以下几类即可：

1. `requirements`
2. `plan`
3. `context_bundle`
4. `task_summary`
5. `review`
6. `final_report`

这些类型已经足够支撑：

1. 单 task 分析
2. 子任务分发
3. 汇总 resume
4. 结果评审

## 11. 与现有模块的关系

### 11.1 与 `project` 的关系

`project` 提供 rootPath 和 project identity，但不拥有知识文档正文。

`project` 只负责：

1. project-local knowledge workspace 的启用约定
2. rootPath 下 `.harbor` 的存在性约束
3. 相关能力的 project-scoped policy

### 11.2 与 `task` 的关系

`task` 不拥有文档系统，但 task 可以关联知识对象。

推荐关系是：

1. task 创建 requirements / summary / review 的引用
2. task 读取 context bundle
3. task 不把文档正文揉进聚合字段

### 11.3 与 future `orchestration` 的关系

如果未来存在 orchestration，它应依赖 knowledge workspace 来：

1. 读取 requirements
2. 生成 plan
3. 派生 context bundle
4. 聚合 sub task 输出

但 orchestration 本身的状态机不应存放在 `.harbor` 文档正文里。

## 12. 推荐的 source-of-truth 设计

推荐采用以下分层：

### 12.1 File-first objects

以下对象的正文以 `.harbor` 文件为主真相：

1. requirements
2. plan
3. context bundle
4. summary
5. review
6. final report

### 12.2 DB-first objects

以下对象以 service 结构化存储为主真相：

1. project
2. task
3. execution
4. execution event
5. task status projection
6. barrier / trigger state

### 12.3 Reference metadata

service 可以保存以下元数据作为索引：

1. knowledge object id
2. file path
3. task relation
4. project relation
5. current version
6. kind
7. digest 或更新时间

但不应复制一份完整正文作为第二真相。

## 13. 第一阶段能力规划

如果按这个方向推进，第一阶段应先提供以下能力：

1. ensure project-local `.harbor` workspace exists
2. create knowledge document
3. read knowledge document
4. update knowledge document
5. list project knowledge documents
6. list task-related knowledge documents
7. build context bundle from selected documents

这几项能力足以支持后续更复杂的 skill 组合。

## 14. 当前不建议立即做的事

第一阶段不建议马上做：

1. 二进制资产系统
2. 通用附件平台
3. 复杂权限模型
4. 文档协同编辑
5. 跨 project 共享知识库
6. 把 execution state 存成 markdown/json 文档
7. 把 orchestration state machine 塞进 `.harbor`

## 15. 推荐的下一步文档

在这份设计之后，推荐按顺序继续补：

1. `document` context design
2. `knowledge workspace` TDD 计划
3. `context bundle` capability design
4. `task batch spawn` capability design
5. `barrier / wait condition` capability design

## 16. 最终结论

在 project root 下引入 `.harbor` 作为 project-local knowledge workspace，这个方向是成立的，而且很适合后续的 skill 组合与 swarm 演进。

但必须坚持三条底线：

1. `.harbor` 承载知识，不承载控制真相
2. 文档正文 file-first，控制状态 db-first
3. 通过稳定 primitive 组合能力，而不是把所有高级语义提前塞进一个巨型功能

一句话总结：

```text
让 agent 直接看见知识工作区，是对的。
让知识工作区取代系统控制模型，是错的。
```
