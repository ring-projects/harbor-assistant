# Workspace Member Management Requirements

## 1. 文档信息

- 文档名称：Workspace Member Management Requirements
- 日期：2026-04-10
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/workspace`
  - `apps/service/src/modules/user`
  - `apps/service/src/modules/auth`
- 关联文档：
  - [./workspace-foundation-requirements-2026-04-06.md](./workspace-foundation-requirements-2026-04-06.md)
  - [./auth-user-service-design-2026-04-01.md](./auth-user-service-design-2026-04-01.md)

## 2. 背景

Harbor 已经具备：

1. `workspace` 聚合
2. `membership` 作为访问关系
3. project 通过 workspace 继承访问控制

但当前 `workspace` 仍然缺少最基本的成员管理写能力：

1. 只能列成员
2. 不能直接把已有 Harbor user 加入 team workspace
3. 不能把成员移出 workspace

这会导致：

1. workspace 模型已经存在
2. 但团队协作仍然无法真正成立

## 3. 本轮目标

本轮只做最小可用的成员管理后端闭环：

1. `owner` 可以向 `team workspace` 添加已有 Harbor user
2. `owner` 可以从 `team workspace` 移除普通成员
3. active member 可以读取 workspace 成员列表
4. 非成员不能读取成员列表

## 4. 本轮不做

为了避免过度设计，本轮明确不做：

1. invitation
2. 通过 email 邀请未注册用户
3. owner transfer
4. `admin` 角色
5. 批量成员导入
6. 复杂审计流

## 5. 设计原则

### 5.1 只管理已经存在的 Harbor user

本轮加成员不负责邀请外部用户。

输入只接受：

1. 已存在 Harbor user 的 `githubLogin`

这样可以复用当前登录体系，不需要提前引入 invitation。

### 5.2 personal workspace 不支持扩展成员

`personal workspace` 的语义应该保持稳定：

```text
一个用户的私有工作区
```

因此：

1. personal workspace 可被读取
2. personal workspace 不允许添加或移除成员

### 5.3 只有 owner 可以管理成员

本轮角色只有：

1. `owner`
2. `member`

因此管理规则收敛为：

1. active owner 可添加成员
2. active owner 可移除普通成员
3. active member 只能查看

### 5.4 本轮不允许移除 owner

由于本轮不实现 owner transfer，移除 owner 会造成模型不完整。

因此：

1. owner membership 不能被移除
2. 若未来要支持 owner transfer，应另开一轮设计

## 6. API 约束

本轮新增：

1. `POST /v1/workspaces/:id/members`
2. `DELETE /v1/workspaces/:id/members/:userId`

保留：

1. `GET /v1/workspaces/:id/members`

### 6.1 Add Member

请求体：

```json
{
  "githubLogin": "octocat"
}
```

行为：

1. 解析 Harbor user
2. 将该 user 作为 `member` 加入 workspace
3. 如果该用户已是 active member，则按幂等成功处理

### 6.2 Remove Member

行为：

1. 只允许移除普通成员
2. 若目标不存在或已是 removed，则按幂等成功处理
3. 若目标是 owner，则返回 invalid state

## 7. 模块边界

### 7.1 workspace 模块负责

1. 成员增删业务规则
2. owner/member 权限判断
3. personal/team 行为差异

### 7.2 user 查找作为 workspace 的外部 port

workspace 不自己拥有 user 聚合。

因此需要一个最小 port：

```ts
findByGithubLogin(githubLogin: string): Promise<User | null>
```

workspace 只消费它，不管理 user 生命周期。

## 8. 验收标准

本轮完成的标准：

1. owner 可把现有 Harbor user 加入 team workspace
2. owner 可移除普通成员
3. member 可查看列表但不能管理成员
4. personal workspace 添加成员会被拒绝
5. owner 移除 owner 会被拒绝
