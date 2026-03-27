# Document TDD 红绿灯计划

## 1. 文档信息

- 文档名称：Document TDD 红绿灯计划
- 日期：2026-03-26
- 状态：Proposed
- 适用范围：
  - future `document` context
  - future `apps/service/src/modules/document`
- 关联文档：
  - [../document-context-design-2026-03-26.md](../document-context-design-2026-03-26.md)
  - [../project-local-knowledge-workspace-design-2026-03-26.md](../project-local-knowledge-workspace-design-2026-03-26.md)
  - [../task-context-design-2026-03-25.md](../task-context-design-2026-03-25.md)
  - [../service-database-schema-design-2026-03-25.md](../service-database-schema-design-2026-03-25.md)

## 2. 目标

这份文档只规划新的 `document` module 如何按 TDD 推进，不讨论 swarm 的完整编排实现，也不讨论前端页面形态。

核心目标有五个：

1. 先把 `Document` 聚合的不变量锁成测试
2. 再把 document commands / queries 的应用编排写成测试
3. 明确 file-first 正文与 metadata persistence 的边界
4. 让 `task` / future orchestration 通过稳定能力消费 document，而不是直接碰内部文件实现
5. 避免把 `document` 退化成任意文件系统 wrapper

## 3. TDD 总原则

新的 `document` module 必须坚持一条底线：

先锁知识对象语义，再接文件系统细节。

推荐顺序：

1. domain tests
2. application command / query tests
3. facade / port tests
4. repository tests
5. route tests
6. cross-context integration tests

不建议的顺序：

1. 先做 `.harbor` 目录扫描
2. 先做 route 和 schema，再反推 `Document`
3. 先做“通用文件操作 API”，再试图把 document 套进去

原因很简单：

`document` 的复杂度首先来自：

1. knowledge identity
2. kind / path / version invariants
3. file-first 与 db-first 的真相划分
4. project / task 关联边界

而不是来自 HTTP 或文件系统本身。

## 4. 测试分层

### 4.1 Domain tests

测试对象：

1. `Document`
2. document status / version / path invariants

这一层只验证领域规则，不碰：

1. 文件系统
2. Prisma
3. Fastify
4. websocket

### 4.2 Application tests

测试对象：

1. `CreateDocument`
2. `GetDocument`
3. `ReadDocumentContent`
4. `UpdateDocumentContent`
5. `PublishDocument`
6. `ArchiveDocument`
7. `ListProjectDocuments`
8. `ListTaskDocuments`

这一层验证：

1. use case 编排
2. project existence / path resolution 调用时机
3. metadata repository 与 content store 的调用顺序
4. 错误分层与返回结果

### 4.3 Port / Facade tests

测试对象：

1. project existence / rootPath facade
2. document content store port
3. document metadata repository port
4. path policy / workspace resolution port

目标是：

1. `document` 不直接依赖具体文件系统实现
2. `document` 不直接依赖 task module 内部实现
3. `.harbor` 路径规则保持可替换、可测试

### 4.4 Repository tests

测试对象：

1. `DocumentRepository`
2. `DocumentContentStore`
3. metadata 与 file content 的映射

这一层只验证：

1. DB mapping 正确
2. file path 落点正确
3. 版本与状态更新正确
4. 不重新证明所有 domain rules

### 4.5 Route tests

测试对象建议：

1. `POST /v1/projects/:projectId/documents`
2. `GET /v1/documents/:documentId`
3. `GET /v1/documents/:documentId/content`
4. `PATCH /v1/documents/:documentId/content`
5. `POST /v1/documents/:documentId/publish`
6. `POST /v1/documents/:documentId/archive`
7. `GET /v1/projects/:projectId/documents`
8. `GET /v1/tasks/:taskId/documents`

这一层只验证：

1. schema validation
2. route 到 use case 的接线
3. response contract

### 4.6 Integration tests

测试对象：

1. `.harbor` workspace 落盘行为
2. document metadata 与文件正文一致性
3. `task` 消费 document 引用的最小路径

这层只覆盖关键边界，不追求大而全。

## 5. 红绿灯开发节奏

所有 use case 都按固定节奏推进：

1. 先写失败测试
2. 再写最小实现让测试变绿
3. 最后做必要重构，不扩边界

### 5.1 红灯

只表达一个明确语义：

1. 输入是什么
2. 当前 document state 是什么
3. 依赖 port 返回什么
4. 期望返回什么结果或错误

要求：

1. 一次只锁一个行为
2. 失败原因必须清晰
3. 不为了顺手通过而提前实现文件系统或 route

### 5.2 绿灯

只补当前测试需要的最小实现：

1. 不提前做 route
2. 不提前做 Prisma
3. 不提前做目录自动扫描
4. 不提前扩成“任意文件管理器”

### 5.3 重构

测试变绿后再做必要重构：

1. 消除重复校验
2. 收紧错误模型
3. 收紧命名与 use case 边界
4. 保持外部 command / query contract 不变

## 6. 第一盏灯：`Document` 聚合纯规则

先写红灯测试：

1. 新 document 创建时具备合法默认状态
2. `version` 初始化正确
3. archived document 不能继续写入
4. `version` 只能递增
5. `kind` 与 `format` 组合受控
6. `path` 必须位于 project `.harbor` workspace 内

变绿目标：

1. `Document` 聚合规则稳定
2. 不引入 repository / file system 依赖

## 7. 第二盏灯：基础 queries

先写红灯测试：

1. `GetDocument(documentId)` 返回 metadata
2. `ReadDocumentContent(documentId)` 返回正文
3. `ListProjectDocuments(projectId)` 返回 project-scoped 列表
4. `ListTaskDocuments(taskId)` 返回 task-scoped 列表
5. invalid projectId / documentId 返回结构化错误

变绿目标：

1. queries 只依赖 metadata repository 与 content store
2. query 不认识 route contract

## 8. 第三盏灯：基础 commands

先写红灯测试：

1. `CreateDocument` 会创建 metadata 与初始正文
2. `UpdateDocumentContent` 会更新正文并递增 version
3. `PublishDocument` 只能发布未归档 document
4. `ArchiveDocument` 会阻止后续继续写正文
5. `CreateDocument` 会拒绝不合法的 path / kind / format

变绿目标：

1. command 编排清晰
2. 失败时不会留下半写状态

## 9. 第四盏灯：workspace / path policy

先写红灯测试：

1. project root 下不存在 `.harbor` 时可被安全初始化
2. `kind` 会落到正确目录
3. 文件名不直接依赖 title
4. path traversal 会被拒绝
5. project 外部路径写入会被拒绝

变绿目标：

1. `.harbor` workspace 规则稳定
2. `document` 不变成任意文件写入器

## 10. 第五盏灯：metadata repository

先写红灯测试：

1. metadata 持久化后可正确读回 aggregate
2. `taskId` / `projectId` / `kind` 查询正确
3. archived / published 状态映射正确
4. `version` / `updatedAt` 持久化正确

变绿目标：

1. repository mapping 正确
2. 不重新实现 domain 规则

## 11. 第六盏灯：content store

先写红灯测试：

1. markdown document 正文可正确写入和读回
2. json document 正文可正确写入和读回
3. 不存在的 content path 会返回结构化错误
4. 更新正文时不会写到错误目录

变绿目标：

1. file-first content store 稳定
2. store 只负责内容，不负责业务判断

## 12. 第七盏灯：route / schema

先写红灯测试：

1. create document request schema 正确
2. update content request schema 正确
3. publish / archive route 接线正确
4. query route 返回 contract 正确

变绿目标：

1. route 只负责 HTTP 接线
2. route 不包含路径规则、版本规则、状态规则

## 13. 第八盏灯：跨上下文最小集成

先写红灯测试：

1. task 可以查询自己关联的 documents
2. future skill / orchestration 可基于 document query 构造 context bundle
3. 删除或归档 document 不会直接破坏 task 聚合

变绿目标：

1. 证明 `document` 是可组合 primitive
2. 不把 orchestration 直接做进 document

## 14. 错误模型收敛建议

推荐尽早定义 `document` 专属错误模型，而不是直接抛裸 `Error`。

第一版至少需要：

1. `document.notFound`
2. `document.projectNotFound`
3. `document.invalidPath`
4. `document.invalidKind`
5. `document.invalidFormat`
6. `document.archived`
7. `document.contentMissing`
8. `document.conflict`

## 15. 第一阶段刻意不做的事

为避免膨胀，第一阶段刻意不做：

1. 二进制资产
2. 富文本编辑器模型
3. 自动 Git 提交
4. 文档全文搜索
5. 跨 project 共享
6. 文档权限系统
7. 文档模板市场
8. execution 强绑定审计链

## 16. 推荐的实现切片

为了保持迭代短小，建议按以下切片推进：

1. `Document` aggregate + domain tests
2. in-memory metadata repository + in-memory content store
3. create / get / read / update use cases
4. archive / publish use cases
5. workspace path policy
6. real file content store
7. real persistence repository
8. route / schema

## 17. 最终结论

`document` 的 TDD 推进必须先锁“知识对象语义”，再接文件系统和 HTTP。

如果顺序反过来，`document` 很快就会退化成：

1. 任意文件写入 API
2. route 驱动的临时工具层
3. 另一个混杂业务与基础设施的大模块

一句话总结：

```text
先证明 Document 是稳定的知识 primitive，
再证明它能安全地落到 `.harbor`。
```
