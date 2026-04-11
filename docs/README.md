# Harbor Docs Guide

本文档用于整理 `docs/` 目录的用途、阅读顺序和当前状态。

> [!IMPORTANT]
> 当前产品基线请先看 [product-prd-2026-04-10.md](./product-prd-2026-04-10.md)。
> Harbor 当前主链路已经收敛为：
> `Workspace -> Project -> Orchestration -> Task`

> [!WARNING]
> 旧 task create/list API 已废弃。
> 当前 canonical contract 为：
> - `POST /v1/orchestrations/:orchestrationId/tasks`
> - `GET /v1/orchestrations/:orchestrationId/tasks`
> 以下旧接口不应再作为当前实现依据：
> - `POST /v1/tasks`
> - `GET /v1/projects/:projectId/tasks`

这份索引只做三件事：

1. 指出哪些文档仍是当前设计依据
2. 指出哪些文档只是实现参考或专项需求
3. 把历史材料与旧主线隔离出来，避免继续污染主目录判断

## 当前阅读顺序

如果你要理解当前产品与系统，优先按这个顺序阅读：

1. [product-prd-2026-04-10.md](./product-prd-2026-04-10.md)
2. [backend-lite-ddd-design-2026-03-24.md](./backend-lite-ddd-design-2026-03-24.md)
3. [auth-user-service-design-2026-04-01.md](./auth-user-service-design-2026-04-01.md)
4. [workspace-foundation-requirements-2026-04-06.md](./workspace-foundation-requirements-2026-04-06.md)
5. [project-dual-source-requirements-2026-04-02.md](./project-dual-source-requirements-2026-04-02.md)
6. [github-app-repository-access-design-2026-04-02.md](./github-app-repository-access-design-2026-04-02.md)
7. [workspace-github-integration-requirements-2026-04-06.md](./workspace-github-integration-requirements-2026-04-06.md)
8. [orchestration-requirements-2026-03-31.md](./orchestration-requirements-2026-03-31.md)
9. [service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
10. [task-event-storage-model.md](./task-event-storage-model.md)
11. [task-api.md](./task-api.md)
12. [project-api.md](./project-api.md)

## 按主题阅读

### 协作与访问

- [auth-user-service-design-2026-04-01.md](./auth-user-service-design-2026-04-01.md)
- [workspace-foundation-requirements-2026-04-06.md](./workspace-foundation-requirements-2026-04-06.md)
- [workspace-member-management-requirements-2026-04-10.md](./workspace-member-management-requirements-2026-04-10.md)
- [workspace-invitation-requirements-2026-04-10.md](./workspace-invitation-requirements-2026-04-10.md)
- [github-login-hardening-requirements-2026-04-03.md](./github-login-hardening-requirements-2026-04-03.md)
- [tdd/workspace-foundation.md](./tdd/workspace-foundation.md)
- [tdd/workspace-member-management.md](./tdd/workspace-member-management.md)
- [tdd/workspace-invitation.md](./tdd/workspace-invitation.md)
- [tdd/github-login-hardening.md](./tdd/github-login-hardening.md)

### Project 与代码源

- [project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
- [project-dual-source-requirements-2026-04-02.md](./project-dual-source-requirements-2026-04-02.md)
- [git-project-boundary-design-2026-03-24.md](./git-project-boundary-design-2026-03-24.md)
- [github-app-repository-access-design-2026-04-02.md](./github-app-repository-access-design-2026-04-02.md)
- [workspace-github-integration-requirements-2026-04-06.md](./workspace-github-integration-requirements-2026-04-06.md)
- [project-api.md](./project-api.md)
- [tdd/project.md](./tdd/project.md)
- [tdd/git.md](./tdd/git.md)
- [tdd/github-app-repository-access.md](./tdd/github-app-repository-access.md)

### Filesystem 与文档

- [filesystem-context-design-2026-03-24.md](./filesystem-context-design-2026-03-24.md)
- [bootstrap-filesystem-api-design-2026-03-26.md](./bootstrap-filesystem-api-design-2026-03-26.md)
- [document-context-design-2026-03-26.md](./document-context-design-2026-03-26.md)
- [project-local-knowledge-workspace-design-2026-03-26.md](./project-local-knowledge-workspace-design-2026-03-26.md)
- [tdd/filesystem.md](./tdd/filesystem.md)
- [tdd/bootstrap-filesystem.md](./tdd/bootstrap-filesystem.md)
- [tdd/document.md](./tdd/document.md)

### 编排与任务执行

- [orchestration-requirements-2026-03-31.md](./orchestration-requirements-2026-03-31.md)
- [task-runtime-requirements-2026-04-10.md](./task-runtime-requirements-2026-04-10.md)
- [task-api.md](./task-api.md)
- [task-event-storage-model.md](./task-event-storage-model.md)
- [tdd/orchestration.md](./tdd/orchestration.md)

### 前端与部署

- [frd-chat-frontend.md](./frd-chat-frontend.md)
- [file-quick-preview-design-2026-04-01.md](./file-quick-preview-design-2026-04-01.md)
- [chat-visual-style-guardrails-2026-03-29.md](./chat-visual-style-guardrails-2026-03-29.md)
- [frontend-testing.md](./frontend-testing.md)
- [web-cloudflare-workers-deployment-2026-04-01.md](./web-cloudflare-workers-deployment-2026-04-01.md)

## 当前文档分类

### 当前产品主文档

- [product-prd-2026-04-10.md](./product-prd-2026-04-10.md)
- [backend-lite-ddd-design-2026-03-24.md](./backend-lite-ddd-design-2026-03-24.md)
- [auth-user-service-design-2026-04-01.md](./auth-user-service-design-2026-04-01.md)
- [workspace-foundation-requirements-2026-04-06.md](./workspace-foundation-requirements-2026-04-06.md)
- [project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
- [project-dual-source-requirements-2026-04-02.md](./project-dual-source-requirements-2026-04-02.md)
- [git-project-boundary-design-2026-03-24.md](./git-project-boundary-design-2026-03-24.md)
- [filesystem-context-design-2026-03-24.md](./filesystem-context-design-2026-03-24.md)
- [bootstrap-filesystem-api-design-2026-03-26.md](./bootstrap-filesystem-api-design-2026-03-26.md)
- [orchestration-requirements-2026-03-31.md](./orchestration-requirements-2026-03-31.md)
- [service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
- [task-event-storage-model.md](./task-event-storage-model.md)

### 当前接口契约

- [task-api.md](./task-api.md)
- [project-api.md](./project-api.md)

### 当前实现规范与参考

- [service-module-standard-based-on-project.md](./service-module-standard-based-on-project.md)
- [service-error-handling-guide.md](./service-error-handling-guide.md)
- [agent-event-projection-design-2026-03-25.md](./agent-event-projection-design-2026-03-25.md)
- [agent-runtime-integration.md](./agent-runtime-integration.md)
- [project-local-skill-bridge.md](./project-local-skill-bridge.md)
- [github-oauth-and-github-app-setup-guide-2026-04-02.md](./github-oauth-and-github-app-setup-guide-2026-04-02.md)

### 当前专项需求与 TDD

- [workspace-member-management-requirements-2026-04-10.md](./workspace-member-management-requirements-2026-04-10.md)
- [workspace-invitation-requirements-2026-04-10.md](./workspace-invitation-requirements-2026-04-10.md)
- [workspace-github-integration-requirements-2026-04-06.md](./workspace-github-integration-requirements-2026-04-06.md)
- [github-login-hardening-requirements-2026-04-03.md](./github-login-hardening-requirements-2026-04-03.md)
- [document-context-design-2026-03-26.md](./document-context-design-2026-03-26.md)
- [tdd/project.md](./tdd/project.md)
- [tdd/git.md](./tdd/git.md)
- [tdd/filesystem.md](./tdd/filesystem.md)
- [tdd/bootstrap-filesystem.md](./tdd/bootstrap-filesystem.md)
- [tdd/document.md](./tdd/document.md)
- [tdd/orchestration.md](./tdd/orchestration.md)
- [tdd/workspace-foundation.md](./tdd/workspace-foundation.md)
- [tdd/workspace-github-integration.md](./tdd/workspace-github-integration.md)
- [tdd/workspace-member-management.md](./tdd/workspace-member-management.md)
- [tdd/workspace-invitation.md](./tdd/workspace-invitation.md)
- [tdd/github-login-hardening.md](./tdd/github-login-hardening.md)

### 已归档的纯历史资料

主目录里不再保留纯历史 review、RCA 和停更方案。见：

- [archive/README.md](./archive/README.md)

## 文档状态约定

后续文档只建议使用下面几种状态：

- `Accepted`
- `Proposed Canonical Design`
- `Reference`
- `Historical`
- `Superseded`
- `Partially Superseded`

避免继续使用 `Draft For Review`、`Proposed Design For Review`、`Outdated` 等额外口径。

## 维护规则

1. 在头部写清 `文档名称 / 日期 / 状态 / 适用范围`
2. 如果替代了旧文档，在头部明确写 `supersedes ...`
3. 如果只是背景资料，直接标 `Reference` 或 `Historical`
4. 纯历史材料移到 `docs/archive/`
5. 不要让两份互相冲突的设计文档同时处于“当前有效”状态
