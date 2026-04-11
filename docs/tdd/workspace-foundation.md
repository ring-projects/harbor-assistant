# Workspace Foundation TDD Plan

## 1. 文档信息

- 文档名称：Workspace Foundation TDD Plan
- 日期：2026-04-06
- 状态：Proposed
- 适用范围：
  - `apps/service/src/modules/workspace`
  - `apps/service/src/modules/project`
  - `apps/service/src/modules/auth`
- 关联文档：
  - [../workspace-foundation-requirements-2026-04-06.md](../workspace-foundation-requirements-2026-04-06.md)
  - [../auth-user-service-design-2026-04-01.md](../auth-user-service-design-2026-04-01.md)
  - [./project.md](./project.md)

## 2. 目标

这份文档定义 `workspace foundation` 的第一轮 TDD 推进方式。

本轮不是要一次性把整个团队协作能力做完，而是先通过测试锁定最小后端行为：

1. `workspace` 的核心规则
2. personal workspace 的自动承接
3. `project -> workspace` 归属
4. membership-scoped 的 project 访问

## 3. TDD 总原则

推荐顺序：

1. workspace domain tests
2. workspace application tests
3. project access tests
4. route tests
5. repository tests

这轮把 repository tests 放在后面，是因为核心复杂度先在：

1. 归属边界
2. personal workspace 规则
3. access adapter 行为

而不是 Prisma 映射本身。

## 4. 测试分层

### 4.1 Domain tests

先锁住：

1. 创建 personal workspace 合法
2. 创建 team workspace 合法
3. 创建 workspace 时自动生成 slug
4. 创建 workspace 时 owner membership 自动存在
5. membership role/status 只能取允许值

### 4.2 Application tests

先锁住：

1. `ensurePersonalWorkspace` 首次调用会创建 workspace 与 owner membership
2. 再次调用会复用已有 personal workspace
3. `listUserWorkspaces` 只返回 active membership 的 workspace
4. `createWorkspace` 会为创建者建立 owner membership

### 4.3 Project access tests

先锁住：

1. 用户可访问其 active membership 对应 workspace 下的 project
2. 非成员不可访问该 project
3. 对尚未迁移到 workspace 的旧 project 仍允许 owner fallback
4. `list` 行为会过滤掉无权 project

### 4.4 Route tests

先锁住：

1. `GET /v1/workspaces` 返回当前用户可访问的 workspace
2. `POST /v1/workspaces` 可创建 team workspace
3. `GET /v1/workspaces/:id/members` 返回成员列表
4. `POST /v1/projects` 在未显式传 `workspaceId` 时会落到 personal workspace
5. project 读取接口不会越权返回其它 workspace 的 project

### 4.5 Repository tests

只验证：

1. workspace 与 membership 的持久化映射
2. personal workspace 查询
3. project 的 `workspaceId` 保存与读取
4. membership 查询条件与排序

## 5. 第一批红灯测试

建议第一批先写以下测试。

### 5.1 Workspace domain

1. `createWorkspace(personal)` 自动带一个 owner membership
2. owner membership 必须属于同一个 workspace
3. workspace 名称为空时失败

### 5.2 Workspace application

1. `ensurePersonalWorkspace` 在没有 personal workspace 时创建它
2. `ensurePersonalWorkspace` 在已有 personal workspace 时不重复创建

### 5.3 Access adapter

1. membership-scoped project repository 会放行同 workspace project
2. membership-scoped project repository 会拒绝无 membership 的 project
3. 对 `workspaceId = null` 的旧 project，owner fallback 仍成立

### 5.4 Routes

1. `GET /workspaces` 初次访问时能看到 personal workspace
2. `POST /projects` 创建成功后响应包含 `workspaceId`
3. 非成员读取 `GET /projects/:id` 返回 not found 或等价隐藏错误

## 6. 绿灯实现顺序

### 6.1 Step 1

先做 `workspace` domain：

1. `Workspace`
2. `Membership`
3. create helpers

### 6.2 Step 2

再做 application use cases：

1. `createWorkspace`
2. `ensurePersonalWorkspace`
3. `listUserWorkspaces`
4. `listWorkspaceMembers`

### 6.3 Step 3

再做 access adapter：

1. 基于 membership 的 project 访问
2. 对旧 owner-scoped 数据保留 fallback

### 6.4 Step 4

最后补：

1. workspace routes
2. project route 接线
3. Prisma repository

## 7. 验收标准

本轮测试完成的标准：

1. workspace 模块 domain/application 的核心行为均有测试
2. project access adapter 的 membership 语义被测试锁定
3. project route 与 workspace route 至少具备一条完整 happy path
4. 对旧 owner fallback 的兼容路径有测试保护
