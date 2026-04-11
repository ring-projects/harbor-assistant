# Workspace GitHub Integration TDD Plan

## 1. 文档信息

- 文档名称：Workspace GitHub Integration TDD Plan
- 日期：2026-04-06
- 状态：Proposed
- 适用范围：
  - `apps/service/src/modules/integration/github`
  - `apps/service/src/modules/workspace`
  - `apps/service/src/modules/project`
- 关联文档：
  - [../workspace-github-integration-requirements-2026-04-06.md](../workspace-github-integration-requirements-2026-04-06.md)

## 2. 目标

本轮 TDD 目标不是做完整团队集成平台，而是锁住 workspace 级 installation 访问的最小后端行为：

1. installation 可被链接到 workspace
2. workspace member 可读取 linked installations
3. repository binding 可依赖 workspace-linked installation

## 3. 推荐顺序

1. route tests
2. application tests
3. repository tests

这轮先从 route tests 开始，因为核心复杂度首先在：

1. setup callback 与 workspaceId 状态传递
2. workspace membership 校验
3. installations / repositories 列表的 contract

## 4. 第一批红灯测试

### 4.1 GitHub integration routes

先写：

1. `install-url` 接受 `workspaceId`
2. setup callback 成功后会把 installation 链接到 workspace
3. `GET /integrations/github/installations?workspaceId=...` 只返回该 workspace 已链接的 installations
4. `GET /integrations/github/installations/:id/repositories?workspaceId=...` 对 workspace member 生效

### 4.2 Project binding routes

再写：

1. workspace member 可读取共享 project 的 repository binding
2. workspace-linked installation 可用于 repository binding
3. provision 后的 managed workspace 路径稳定使用 `workspaceId/projectId`

### 4.3 Application tests

最后写：

1. `linkInstallationToWorkspace`
2. `listWorkspaceInstallations`
3. `resolveWorkspaceInstallationAccess`

## 5. 验收标准

本轮测试完成的标准：

1. workspace-installation link 行为有测试保护
2. workspace member 的 installation/repository 读取有测试保护
3. project binding 消费 workspace-linked installation 的路径有测试保护
