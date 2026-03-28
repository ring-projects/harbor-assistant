# Harbor Docs Guide

本文档用于整理 `docs/` 目录的用途、阅读顺序和当前状态。

目标只有三个：

1. 明确哪些文档是当前主文档
2. 明确哪些文档是接口契约或实现规范
3. 明确哪些文档只是历史背景，不应再作为当前设计依据

## 阅读顺序

如果你要理解当前系统，优先按这个顺序阅读：

1. [backend-lite-ddd-design-2026-03-24.md](./backend-lite-ddd-design-2026-03-24.md)
2. [project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
3. [git-project-boundary-design-2026-03-24.md](./git-project-boundary-design-2026-03-24.md)
4. [filesystem-context-design-2026-03-24.md](./filesystem-context-design-2026-03-24.md)
5. [bootstrap-filesystem-api-design-2026-03-26.md](./bootstrap-filesystem-api-design-2026-03-26.md)
6. [task-runtime-system-design-2026-03-23.md](./task-runtime-system-design-2026-03-23.md)
7. [service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
8. [task-event-storage-model.md](./task-event-storage-model.md)
9. [task-api.md](./task-api.md)
10. [project-api.md](./project-api.md)
11. [service-module-standard-based-on-project.md](./service-module-standard-based-on-project.md)
12. [service-error-handling-guide.md](./service-error-handling-guide.md)
13. [agent-event-projection-design-2026-03-25.md](./agent-event-projection-design-2026-03-25.md)

如果你要按 TDD 推进模块开发，再继续看：

1. [tdd/project.md](./tdd/project.md)
2. [tdd/git.md](./tdd/git.md)
3. [tdd/filesystem.md](./tdd/filesystem.md)
4. [tdd/bootstrap-filesystem.md](./tdd/bootstrap-filesystem.md)
5. [tdd/task.md](./tdd/task.md)
6. [tdd/task-structured-input.md](./tdd/task-structured-input.md)

如果你在做前端，再继续看：

1. [frd-frontend.md](./frd-frontend.md)
2. [frd-task-frontend.md](./frd-task-frontend.md)
3. [frd-chat-frontend.md](./frd-chat-frontend.md)
4. [frontend-testing.md](./frontend-testing.md)

## 分类

### 当前主文档

- [backend-lite-ddd-design-2026-03-24.md](./backend-lite-ddd-design-2026-03-24.md)
  - 当前后端整体优化总设计
  - 当前 bounded context / aggregate / dependency direction 以这份文档为准

- [project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
  - `project` context 的聚焦设计文档
  - 当前 `Project` / `ProjectSettings` 聚合边界与演进方向以这份文档为准

- [git-project-boundary-design-2026-03-24.md](./git-project-boundary-design-2026-03-24.md)
  - `git` 与 `project` 的边界设计文档
  - 当前 `git` 对 `project` 的依赖方向与迁移顺序以这份文档为准

- [filesystem-context-design-2026-03-24.md](./filesystem-context-design-2026-03-24.md)
  - `filesystem` 的边界设计文档
  - 当前 root-scoped 文件访问边界与对 `project` 的依赖方向以这份文档为准

- [bootstrap-filesystem-api-design-2026-03-26.md](./bootstrap-filesystem-api-design-2026-03-26.md)
  - pre-project filesystem browse API 的边界设计文档
  - 当前项目创建前目录选择能力以这份文档为准

- [task-runtime-system-design-2026-03-23.md](./task-runtime-system-design-2026-03-23.md)
  - 当前 task / runtime / project 主设计，以及 runtime-policy 应用层能力的边界判断
  - 当前 runtime aggregate 语义以这份文档为准

- [service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
  - 当前数据库重建主文档
  - 当前 `Project / Task / Execution / ExecutionEvent` 存储边界以这份文档为准

- [task-event-storage-model.md](./task-event-storage-model.md)
  - 已接受的事件存储原则
  - 当前 raw event source-of-truth 规则以这份文档为准

- [task-structured-input-requirements-2026-03-28.md](./task-structured-input-requirements-2026-03-28.md)
  - task 结构化输入、本地图片、输入落库边界的当前需求文档
  - 当前 `Task.prompt` 与 `ExecutionEvent` 的职责收敛以这份文档为准

### 当前接口契约

- [task-api.md](./task-api.md)
  - 当前 task service / HTTP API / event query 行为基线

- [project-api.md](./project-api.md)
  - 当前 project service / API 行为基线

### 当前实现规范

- [service-module-standard-based-on-project.md](./service-module-standard-based-on-project.md)
  - `apps/service` 模块结构收敛样板

- [service-error-handling-guide.md](./service-error-handling-guide.md)
  - `apps/service` 错误处理接入规范

- [agent-event-projection-design-2026-03-25.md](./agent-event-projection-design-2026-03-25.md)
  - agent raw event 到 Harbor event 的投射边界说明
  - 当前 projection 与前端 reducer 分层以这份文档为准

- [tdd/project.md](./tdd/project.md)
  - `project` 模块的 TDD 推进顺序与测试分层计划

- [tdd/git.md](./tdd/git.md)
  - `git` 模块的红灯 / 绿灯 / 重构推进计划

- [tdd/filesystem.md](./tdd/filesystem.md)
  - `filesystem` 模块的红灯 / 绿灯 / 重构推进计划

- [tdd/bootstrap-filesystem.md](./tdd/bootstrap-filesystem.md)
  - bootstrap filesystem browse API 的 TDD 推进计划

- [tdd/task.md](./tdd/task.md)
  - `task` 模块的整体 TDD 推进顺序与测试分层计划

- [tdd/task-structured-input.md](./tdd/task-structured-input.md)
  - task 结构化输入与本地图片接入的专项红绿灯计划

- [frontend-testing.md](./frontend-testing.md)
  - `apps/web` 测试策略与实践指南

- [project-local-skill-bridge.md](./project-local-skill-bridge.md)
  - project-local skill bridge 的当前设计

- [agent-runtime-integration.md](./agent-runtime-integration.md)
  - 各 runtime 集成能力调研说明
  - 它是能力参考，不是当前主模型定义文档

### 产品需求与前端设计

- [prd-executor-service.md](./prd-executor-service.md)
  - 早期执行层产品需求文档
  - 用于理解产品目标与非功能要求

- [frd-frontend.md](./frd-frontend.md)
  - 前端总体需求文档

- [frd-task-frontend.md](./frd-task-frontend.md)
  - task 工作台前端需求文档

- [frd-chat-frontend.md](./frd-chat-frontend.md)
  - chat 面板前端需求文档

### 历史设计与背景资料

- [service-implementation-review-2026-03-08.md](./service-implementation-review-2026-03-08.md)
  - 某个时间点的实现评审快照
  - 适合作为风险清单，不适合作为当前模块边界定义

- [service-spawn-ebadf-rca-2026-03-18.md](./service-spawn-ebadf-rca-2026-03-18.md)
  - incident RCA / 运维背景文档

## 文档状态约定

后续文档建议只使用下面几种状态：

- `Accepted`
  - 已确认、可作为当前规则依据

- `Proposed Canonical Design`
  - 当前建议采用的主设计，待继续细化

- `Reference`
  - 参考说明、调研结论、实现指南

- `Historical`
  - 历史资料，不应再作为当前设计依据

- `Superseded`
  - 已被新文档明确替代

- `Partially Superseded`
  - 其中部分原则仍有效，但核心模型或实施路径已被替代

## 维护规则

新增文档时建议遵守：

1. 在头部写清 `文档名称 / 日期 / 状态 / 适用范围`
2. 如果替代了旧文档，在头部明确写 `supersedes ...`
3. 如果只是背景资料，不要写成 `Draft`，直接标 `Reference` 或 `Historical`
4. 仓库内链接优先使用相对路径
5. 不要让两份互相冲突的设计文档同时处于“当前有效”状态
