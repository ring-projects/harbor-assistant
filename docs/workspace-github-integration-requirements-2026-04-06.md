# Workspace GitHub Integration Requirements

## 1. 文档信息

- 文档名称：Workspace GitHub Integration Requirements
- 日期：2026-04-06
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/integration/github`
  - `apps/service/src/modules/workspace`
  - `apps/service/src/modules/project`
- 关联文档：
  - [./workspace-foundation-requirements-2026-04-06.md](./workspace-foundation-requirements-2026-04-06.md)
  - [./github-app-repository-access-design-2026-04-02.md](./github-app-repository-access-design-2026-04-02.md)

## 2. 背景

当前 Harbor 已经开始把 `project` 归属迁移到 `workspace`，并让 project 子资源访问走 workspace membership。

但 GitHub App installation 仍然保留旧语义：

1. installation 由某个 Harbor user 认领
2. installation 列表按 `installedByUserId` 查询
3. repository binding 创建也按 `installedByUserId` 校验

这会导致一个明显问题：

```text
workspace 已经是共享的，
但 installation 访问还是用户私有的。
```

结果就是：

1. coworker 可以看到 project
2. coworker 也许可以读取已绑定项目
3. 但 coworker 不能自然地为共享 workspace 选择 installation 或创建 binding

## 3. 本轮目标

本轮只做 workspace 级 GitHub integration 的最小后端闭环：

1. installation 可以显式接入某个 workspace
2. workspace member 可以读取该 workspace 可用的 installations
3. workspace member 可以读取 installation 下的 repositories
4. git project 的 repository binding 可以消费 workspace-linked installation

## 4. 本轮不做

为了避免过度设计，本轮不纳入：

1. 多 workspace 之间复杂共享策略
2. installation 从一个 workspace 转移到另一个 workspace 的流程
3. invitation 与 GitHub integration 联动
4. frontend 交互改造
5. provider 抽象

## 5. 设计原则

### 5.1 installation 与 workspace 的关系必须显式建模

不要继续依赖：

1. `installedByUserId`
2. project owner
3. 当前请求用户

来隐式推出“这个 workspace 是否可使用这个 installation”。

应该显式建模：

```text
workspace <-> github installation
```

### 5.2 installation 实体本身不直接归属于 workspace

本轮不建议把 `workspaceId` 直接塞进 `GitHubAppInstallation`。

原因：

1. installation 是 provider 侧实体镜像
2. workspace 是 Harbor 内部协作边界
3. 两者应该通过 link record 关联，而不是强耦合成同一个实体

### 5.3 允许平滑过渡

为了不打断现有 API 使用方式，本轮允许保留一个过渡行为：

1. 如果当前用户已拥有 installation
2. 且正在为自己可访问的 workspace 创建 repository binding
3. 服务端可以在同一事务语义下自动补齐 workspace-installation link

这不是长期边界，而是为了避免后端一次性强切导致现有 flow 直接断掉。

## 6. 领域模型

新增 link record：

```ts
WorkspaceGitHubInstallation {
  workspaceId: string
  installationId: string
  linkedByUserId: string
  createdAt: Date
  updatedAt: Date
}
```

它只表达：

1. 哪个 workspace 可使用哪个 GitHub installation
2. 这条关系是谁建立的

它不表达：

1. installation token
2. repo binding
3. project source

## 7. API 约束

本轮建议支持：

1. `GET /v1/integrations/github/app/install-url?workspaceId=...`
2. `GET /v1/integrations/github/installations?workspaceId=...`
3. `GET /v1/integrations/github/installations/:installationId/repositories?workspaceId=...`

语义如下：

1. 带 `workspaceId` 时，所有访问必须先通过 workspace membership 校验
2. setup callback 成功后，installation 会链接到对应 workspace
3. 不带 `workspaceId` 时，仍保留当前用户级查询作为兼容路径

## 8. project binding 规则

本轮 `ProjectRepositoryBinding` 创建规则调整为：

1. project 本身的访问先通过 workspace membership 校验
2. 如果 installation 已链接到 project.workspaceId，则允许使用
3. 如果 installation 尚未链接，但当前 actor 是 installation 的拥有者，则允许自动补 link 后继续
4. 如果两者都不满足，则拒绝

这样可以同时满足：

1. 共享 workspace 的稳定授权边界
2. 旧 flow 的平滑迁移

## 9. 验收标准

本轮完成的标准：

1. 后端存在 workspace-installation link persistence
2. GitHub App setup 可把 installation 接入 workspace
3. workspace member 可查询 workspace 级 installations 与 repositories
4. project repository binding 开始消费 workspace-linked installation
