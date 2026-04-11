# Workspace Invitation TDD Plan

## 1. 文档信息

- 文档名称：Workspace Invitation TDD Plan
- 日期：2026-04-10
- 状态：Proposed
- 适用范围：
  - `apps/service/src/modules/workspace`
  - `apps/service/src/modules/auth`
- 关联文档：
  - [../workspace-invitation-requirements-2026-04-10.md](../workspace-invitation-requirements-2026-04-10.md)

## 2. 目标

这轮 TDD 目标是锁住 invitation 的最小后端行为：

1. owner 创建 invitation
2. invitee 接受 invitation
3. 登录回调自动承接 pending invitations

## 3. 推荐顺序

1. domain tests
2. application tests
3. route tests
4. auth callback integration tests
5. repository tests

## 4. 第一批红灯测试

### 4.1 Domain

先写：

1. 创建 invitation 合法
2. 个人 workspace 创建 invitation 失败
3. 接受 invitation 后状态变为 accepted

### 4.2 Application

先写：

1. owner 可创建 invitation
2. 重复创建同 login 的 pending invitation 时幂等返回
3. invitee 可接受 invitation 并生成 membership
4. 非 invitee 接受 invitation 失败

### 4.3 Route

先写：

1. `POST /workspaces/:id/invitations`
2. `GET /workspaces/:id/invitations`
3. `POST /workspace-invitations/:invitationId/accept`

### 4.4 Auth callback

先写：

1. 登录成功后自动接受匹配 githubLogin 的 pending invitation

## 5. 验收标准

本轮测试完成的标准：

1. invitation 生命周期有 domain/application 测试保护
2. route contract 被锁定
3. 登录自动承接 invitation 有测试保护
