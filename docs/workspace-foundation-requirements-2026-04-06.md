# Workspace Foundation Requirements

## 1. 文档信息

- 文档名称：Workspace Foundation Requirements
- 日期：2026-04-06
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/workspace`
  - `apps/service/src/modules/project`
  - `apps/service/src/modules/auth`
  - `apps/service/src/modules/task`
  - `apps/service/src/modules/orchestration`
  - `apps/service/src/modules/filesystem`
  - `apps/service/src/modules/git`
- 关联文档：
  - [./auth-user-service-design-2026-04-01.md](./auth-user-service-design-2026-04-01.md)
  - [./project-dual-source-requirements-2026-04-02.md](./project-dual-source-requirements-2026-04-02.md)
  - [./service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)

## 2. 背景

Harbor 当前已经从单机工具形态走向“部署在一台服务器上，供自己或小团队使用”的产品形态。

但当前系统的一级主语仍然是 `project`：

1. `Project` 自身保存 `ownerUserId`
2. 认证后的资源访问按 owner-scoped 过滤
3. `task / orchestration / filesystem / git` 都通过 `project` 继承权限
4. 首页与前端全局状态也直接围绕 `project` 建模

这套模型在单人场景下成立，但无法自然支持：

1. 一个工作区内多个项目
2. 多人共享一组项目
3. 未来的工作区级设置、集成、知识空间与审计

## 3. 本轮目标

本轮不追求一次性做完完整团队协作系统，只做一条最小但真实的后端闭环：

1. 引入 `workspace` 作为新的业务归属边界
2. 引入 `membership` 作为用户访问 workspace 的关系模型
3. 让 `project` 开始归属到 `workspace`
4. 让 project 相关资源访问开始具备 workspace membership 语义
5. 保持现有 project-centric runtime 接口可继续工作

一句话总结：

```text
workspace 成为归属边界，
project 继续作为执行与内容容器。
```

## 4. 本轮明确不做

为了避免过度设计，本轮不纳入：

1. `invitation` 实体与邀请流程
2. 复杂 RBAC 或 capability 矩阵
3. project 级 ACL
4. frontend workspace-first 导航重构
5. GitHub installation 与 workspace 级集成归属重构
6. 旧数据的复杂后台迁移任务

本轮只建立后端基础边界，不抢跑未来所有能力。

## 5. 设计原则

### 5.1 Workspace 只负责业务归属，不负责技术工作目录

这里的 `workspace` 必须是业务实体，不是本地 checkout 或 project-local `.harbor` 目录。

因此：

1. `workspace` 不持有 `rootPath`
2. `workspace` 不表达 git branch 或 working tree
3. project 的 `rootPath / normalizedPath / source` 仍然留在 `project`

### 5.2 Project 仍然是 runtime 与内容边界

本轮不把 `task / orchestration / document` 挂到 `workspace`。

它们继续通过 `projectId` 工作。

原因：

1. 当前运行时与接口已经稳定围绕 `projectId`
2. 这些资源的真正执行上下文仍然是 project root
3. 过早把它们提到 workspace 会把边界重新打散

### 5.3 Membership 是关系模型，不是用户本身

本轮不把成员直接建模成“某个人”。

应明确区分：

1. `User` 是用户实体
2. `Membership` 是用户与 workspace 的关系记录

这样后续如果增加：

1. `role`
2. `status`
3. `joinedAt`
4. `removedAt`

都不会把语义搞乱。

### 5.4 先做 workspace 级访问，不做 project 级授权细分

本轮授权规则只做一条：

```text
active membership => 可访问该 workspace 下的全部 project
```

这样才能把系统先从 owner-scoped 迁到 workspace-scoped，而不是掉进过早的权限复杂度。

## 6. 领域模型

### 6.1 Workspace

`Workspace` 表达：

1. 工作区身份
2. 工作区类型
3. 工作区名称
4. 工作区生命周期

建议字段：

- `id`
- `slug`
- `name`
- `type`: `personal | team`
- `status`: `active | archived`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `archivedAt`

### 6.2 Membership

`Membership` 表达：

1. 哪个用户属于哪个 workspace
2. 当前关系状态
3. 当前关系角色

建议字段：

- `workspaceId`
- `userId`
- `role`: `owner | member`
- `status`: `active | removed`
- `createdAt`
- `updatedAt`

本轮故意不引入 `admin`，也不引入更多状态。

### 6.3 Project

`Project` 本轮新增：

- `workspaceId: string | null`

并保留现有：

- `ownerUserId: string | null`

这里的 `ownerUserId` 是过渡字段，不再是长期归属边界。

它在本轮的作用只有两个：

1. 兼容已有 owner-scoped 代码与数据
2. 在 workspace foundation 切入时减少一次性重构成本

长期方向仍然是：

```text
project belongs to workspace
```

## 7. 模块边界

### 7.1 workspace 模块负责

1. `Workspace` 聚合
2. `Membership` 关系
3. personal workspace 创建规则
4. workspace 读取与基本创建
5. workspace 成员列表读取

### 7.2 project 模块继续负责

1. `Project` 身份与 profile
2. `ProjectSource`
3. project-local settings
4. rootPath / normalizedPath
5. project 生命周期

### 7.3 auth 模块负责

1. 当前请求 actor 解析
2. 访问边界接线
3. 用 workspace membership 替代单纯 owner 过滤

auth 不拥有 workspace 领域规则，只消费 workspace 提供的 membership 事实。

### 7.4 task / orchestration / filesystem / git 模块继续负责

1. 通过 `projectId` 工作
2. 不直接依赖 workspace 领域对象
3. 只在外层通过 project-access adapter 获得访问控制

也就是说：

```text
workspace 不直接侵入 runtime 子域，
它只改变 project 的归属与访问入口。
```

## 8. 访问控制要求

### 8.1 访问继承链

统一采用：

```text
user -> membership -> workspace -> project -> child resources
```

### 8.2 本轮规则

本轮只要求：

1. 用户能访问自己是 `active membership` 的 workspace
2. 用户能访问这些 workspace 下的全部 project
3. 非成员不能读取、修改、归档、删除 project
4. `task / orchestration / filesystem / git` 等 project 子资源也必须继承这个约束

### 8.3 Personal workspace

为了兼容当前“用户登录后即可创建 project”的体验，本轮要求：

1. 每个用户最多拥有一个 `personal` workspace
2. 当用户首次需要 workspace 上下文时，系统可以自动创建 personal workspace
3. 未显式指定 `workspaceId` 的新 project 默认进入 personal workspace

## 9. API 约束

本轮只要求最小 workspace API：

1. `GET /v1/workspaces`
2. `POST /v1/workspaces`
3. `GET /v1/workspaces/:id/members`

同时保持现有 project API 可继续使用：

1. `GET /v1/projects`
2. `POST /v1/projects`
3. `GET /v1/projects/:id`
4. 其他 project 子路由

兼容策略：

1. `POST /v1/projects` 可继续不显式传 `workspaceId`
2. 服务端自动解析并使用当前用户 personal workspace
3. project 响应体可新增 `workspaceId`

## 10. 持久化要求

本轮数据库需要新增：

1. `Workspace`
2. `WorkspaceMembership`
3. `Project.workspaceId`

本轮不移除：

1. `Project.ownerUserId`

原因不是它仍然正确，而是：

1. 它能作为过渡期兼容字段
2. 能减少一次性变更面积
3. 可以把“引入 workspace”与“清除 ownerUserId”拆成两轮

## 11. 迭代验收标准

本轮完成的标准不是“完整团队系统上线”，而是满足以下条件：

1. 服务端存在独立 `workspace` 模块
2. authenticated user 可读取自己的 workspace 列表
3. 新建 project 时会落到 workspace 之下
4. project 相关受保护资源访问开始具备 workspace membership 判断
5. 现有 project-centric runtime API 未被 workspace 重构打散

## 12. 后续但非本轮工作

下一轮可以在此基础上继续做：

1. invitation
2. workspace member 管理写接口
3. workspace-first 前端导航
4. GitHub integration 改成 workspace 归属
5. 删除 `ownerUserId`
6. 更细粒度 capability / role 体系
