# Workspace Invitation Requirements

## 1. 文档信息

- 文档名称：Workspace Invitation Requirements
- 日期：2026-04-10
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/workspace`
  - `apps/service/src/modules/auth`
- 关联文档：
  - [./workspace-member-management-requirements-2026-04-10.md](./workspace-member-management-requirements-2026-04-10.md)
  - [./workspace-foundation-requirements-2026-04-06.md](./workspace-foundation-requirements-2026-04-06.md)

## 2. 背景

当前 Harbor 已支持：

1. 登录后自动 personal workspace
2. 创建 team workspace
3. owner 直接把已有 Harbor user 加为 member

但这还不是完整的“邀请人进入 workspace”流程。

缺口在于：

1. 被邀请者可能尚未注册 Harbor
2. owner 不应被迫等对方先注册再手动添加
3. invitation 应是稳定记录，而不是一次性临时动作

## 3. 本轮目标

本轮只实现最小 invitation 后端闭环：

1. owner 可为 team workspace 创建 invitation
2. invitation 以 `inviteeGithubLogin` 为目标身份
3. 被邀请者登录后，系统可自动承接匹配 invitation
4. 已登录的被邀请者也可显式接受 invitation
5. owner 可查看 workspace invitations

## 4. 本轮不做

本轮不纳入：

1. email invitation
2. 外发通知
3. invitation revoke / resend
4. invitation token link
5. admin 角色

## 5. 设计原则

### 5.1 invitation 目标先绑定 GitHub login

当前 Harbor 登录主入口是 GitHub OAuth。

因此本轮 invitation 最小目标身份使用：

1. `inviteeGithubLogin`

这样做的好处是：

1. 与现有登录体系一致
2. 不需要先引入 email verification
3. 便于在登录回调时自动匹配承接

### 5.2 invitation 不等于 membership

`Invitation` 是待兑现关系，不应混进 `Membership` 本体。

因此应单独持久化：

1. 待接受
2. 已接受
3. 已取消

### 5.3 只有 owner 可创建 invitation

本轮角色仍然只有：

1. `owner`
2. `member`

因此：

1. owner 可创建 invitation
2. member 只能查看自己是否属于 workspace，不管理 invitation

### 5.4 只允许邀请 team workspace

`personal workspace` 语义不变：

```text
单用户私有空间
```

所以：

1. personal workspace 不允许 invitation

## 6. 领域模型

建议新增：

```ts
WorkspaceInvitation {
  id: string
  workspaceId: string
  inviteeGithubLogin: string
  role: "member"
  status: "pending" | "accepted" | "revoked"
  invitedByUserId: string
  acceptedByUserId: string | null
  createdAt: Date
  updatedAt: Date
  acceptedAt: Date | null
}
```

本轮 role 固定为 `member`，不开放其它角色。

## 7. API 约束

本轮新增：

1. `GET /v1/workspaces/:id/invitations`
2. `POST /v1/workspaces/:id/invitations`
3. `POST /v1/workspace-invitations/:invitationId/accept`

### 7.1 创建邀请

请求体：

```json
{
  "githubLogin": "octocat"
}
```

行为：

1. 仅 owner 可创建
2. 若该 login 已是 active member，则返回 invalid state
3. 若已有 pending invitation，则按幂等返回该 invitation

### 7.2 接受邀请

行为：

1. 仅 invitee 对应用户可接受
2. 接受后自动生成 active membership
3. invitation 标记为 accepted

## 8. 登录回调接线

本轮要求：

1. 用户完成 GitHub OAuth 登录后
2. 在创建/复用 personal workspace 之后
3. 系统自动查找 `inviteeGithubLogin = current github login` 的 pending invitations
4. 自动接受这些 invitation

这样可保证：

1. 先邀请后注册的用户可以直接进入团队 workspace

## 9. 验收标准

本轮完成的标准：

1. team workspace owner 可创建 invitation
2. pending invitation 可查询
3. invited user 登录后可自动成为 member
4. invited user 也可显式 accept
5. personal workspace invitation 会被拒绝
