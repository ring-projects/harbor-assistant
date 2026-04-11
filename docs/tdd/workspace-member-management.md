# Workspace Member Management TDD Plan

## 1. 文档信息

- 文档名称：Workspace Member Management TDD Plan
- 日期：2026-04-10
- 状态：Proposed
- 适用范围：
  - `apps/service/src/modules/workspace`
  - `apps/service/src/modules/user`
- 关联文档：
  - [../workspace-member-management-requirements-2026-04-10.md](../workspace-member-management-requirements-2026-04-10.md)

## 2. 目标

本轮 TDD 目标是锁住最小成员管理后端行为：

1. team workspace 可添加已有 Harbor user
2. team workspace 可移除普通成员
3. owner/member/outsider 的权限边界清楚

## 3. 推荐顺序

1. domain tests
2. application tests
3. route tests
4. repository tests

## 4. 第一批红灯测试

### 4.1 Domain

先写：

1. team workspace 可添加 member
2. personal workspace 添加 member 失败
3. owner 不能被移除
4. 移除普通 member 后状态变为 removed

### 4.2 Application

先写：

1. owner 可通过 githubLogin 添加成员
2. 非 owner 添加成员失败
3. owner 可移除普通成员
4. 非 member 读取成员列表失败

### 4.3 Route

先写：

1. `GET /workspaces/:id/members` 对 member 成功
2. `POST /workspaces/:id/members` 对 owner 成功
3. `POST /workspaces/:id/members` 对普通 member 返回 forbidden
4. `DELETE /workspaces/:id/members/:userId` 对 owner 成功

## 5. 验收标准

本轮测试完成的标准：

1. workspace 成员增删规则有 domain tests
2. githubLogin -> user 解析的 application path 有测试保护
3. route 层权限与 contract 有测试保护
