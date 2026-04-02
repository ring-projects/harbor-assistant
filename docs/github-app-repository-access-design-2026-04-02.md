# Harbor GitHub App 私有仓库访问方案设计

## 1. 文档信息

- 文档名称：Harbor GitHub App 私有仓库访问方案设计
- 日期：2026-04-02
- 状态：Proposed Design For Review
- 适用范围：
  - `apps/service/src/modules/auth`
  - `apps/service/src/modules/project`
  - future `apps/service/src/modules/integration`
  - future `apps/service/src/modules/repository-access`
  - `apps/service/src/modules/git`
  - `apps/web` 中 GitHub 集成与 git project onboarding 流程
- 关联文档：
  - [./auth-user-service-design-2026-04-01.md](./auth-user-service-design-2026-04-01.md)
  - [./project-dual-source-requirements-2026-04-02.md](./project-dual-source-requirements-2026-04-02.md)
  - [./git-project-boundary-design-2026-03-24.md](./git-project-boundary-design-2026-03-24.md)
  - [./project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
  - [./project-api.md](./project-api.md)

## 2. 文档目标

本文定义 Harbor 在“GitHub OAuth 只负责登录”的前提下，如何增加对 GitHub 私有仓库的受控访问能力。

本文回答以下问题：

1. 为什么 GitHub 私有仓库访问不应继续挂在 `auth` 流程下面
2. 为什么 Harbor 当前阶段更适合采用 `GitHub App + installation token`
3. Harbor 内部应如何划分 `auth / project / integration / git` 的职责
4. 项目、仓库绑定、workspace provision 三者应如何协作
5. 最小可落地版本需要哪些数据模型、接口和安全约束

本文不试图在第一版解决以下问题：

1. 完整多租户 organization / workspace 权限系统
2. GitHub Marketplace 上架流程
3. pull request 写入、issue 自动化、checks 等更高阶 GitHub App 能力
4. 多 provider 统一抽象
5. 自动双向同步所有远端变更

## 3. 背景与问题

### 3.1 当前 GitHub OAuth 只承担身份提供方职责

Harbor 当前认证设计已经明确：

```text
GitHub 负责证明“你是谁”。
Harbor session 负责“你是否已登录 Harbor”。
```

这意味着：

1. GitHub OAuth 的主要职责是登录
2. Harbor 当前 session 才是系统内主登录态
3. GitHub access token 不应被视为 Harbor 主会话

这条边界是正确的，不应因为“需要读私有仓库”而被打破。

### 3.2 当前 `git` source 只表达仓库引用，不负责实际访问

`project` 当前已经支持两种 source：

1. `rootPath`
2. `git`

其中 `git` source 的意义只是：

```text
Project 由一个 git repository reference 定义，
但不保证 Harbor 已经拥有对应的本地 workspace。
```

当前 requirement 也明确把以下能力排除在外：

1. 自动 `git clone`
2. 自动 `git pull`
3. background workspace provision

因此，如果 Harbor 要真正访问 GitHub 私有仓库，就需要补上一条新的系统能力，而不是修改 `git` 模块的边界定义。

### 3.3 继续使用用户长期 token / SSH key 不是默认正解

对于单用户自托管环境，保存个人 PAT 或 SSH key 确实能工作。

但从 Harbor 作为“可部署团队服务”的目标看，这条路存在明显问题：

1. 服务端将长期持有用户个人凭据
2. 个人身份与服务访问边界混在一起
3. 多用户场景下很难保证 repo 级授权与审计
4. 用户离职、token 过期、key 轮换都会回流成 Harbor 内部复杂性
5. 容易把“谁登录了 Harbor”误解成“Harbor 可以访问他所有私仓”

因此，用户个人凭据方案可以作为本地或单用户 fallback，但不应成为默认主方案。

## 4. 核心结论

### 4.1 GitHub 私有仓库访问不是 `auth` 的扩展，而是另一条集成流程

系统里应明确分成三层：

1. `Auth`
   解决“这个用户是谁，是否已登录 Harbor”
2. `Repository Access Integration`
   解决“Harbor 这个服务是否有权访问某个 GitHub repo”
3. `Harbor Internal Authorization`
   解决“Harbor 内部哪个用户可以看到、绑定、操作哪个 project / repo”

最核心的一句话：

```text
GitHub OAuth answers who the user is.
GitHub App answers what repositories Harbor may access.
Harbor authorization answers which Harbor user may use that access.
```

### 4.2 推荐主方案：`GitHub App + installation token`

Harbor 当前阶段最合理的私有仓库访问方案是：

1. 保持 GitHub OAuth 只做登录
2. 新增一个私有的 GitHub App，专门用于 repo access
3. Harbor 服务端保存 GitHub App 自身凭据
4. Harbor 在需要访问仓库时，按 installation 动态换取短期 token
5. Harbor 只在内存中使用 installation token，不长期持久化

### 4.3 `git` 模块仍然保持 path-based，不直接接 GitHub 概念

`git` 模块已有正确方向：

```text
Project owns project identity and root-path semantics.
Git is a path-based wrapper around repository semantics.
```

因此不建议让 `git` module 直接感知：

1. `installationId`
2. `GitHubApp`
3. OAuth identity
4. repo binding ownership

更合理的结构是：

```text
project-scoped orchestration / provision flow
  -> repository-access service: resolve repo binding and temporary credentials
  -> workspace provisioner: ensure local clone exists
  -> git module: operate on local path
```

## 5. 设计原则

### 5.1 登录与 repo access 必须解耦

不要把“连接 GitHub 仓库”实现成“扩大登录 scope”。

原因：

1. 登录 token 的寿命和 repo access token 的寿命不同
2. 登录的授权边界应该尽量稳定和最小化
3. repo access 会自然演化出安装、撤销、范围变更、repo 解绑等流程
4. 这类流程和登录态生命周期不是一回事

### 5.2 Harbor 只持有服务级凭据，不默认持有用户个人长期凭据

Harbor 默认只应长期持有：

1. GitHub App `App ID`
2. GitHub App `private key`
3. webhook secret

Harbor 默认不应长期持有：

1. 用户 PAT
2. 用户 SSH 私钥
3. 用户 OAuth access token
4. 带明文 token 的 remote URL

### 5.3 repo access 必须显式绑定到 project

不要让系统出现“只要 Harbor 安装过 GitHub App，任意用户都能导入任意 repo”的隐式模型。

最少也应显式建模：

1. 哪个 project 对应哪个仓库
2. 该仓库由哪个 installation 授权
3. 这个 project 属于哪个 Harbor 用户

### 5.4 installation token 只按需换取，不长期保存

推荐语义：

```text
需要访问仓库时临时换 token，
用完即丢弃，
数据库只保存 installation identity，不保存 installation token。
```

### 5.5 clone / fetch 的凭据注入不能污染仓库 remote

不要把 token 直接写进：

1. 数据库中的 `repositoryUrl`
2. 本地 `.git/config` remote URL
3. 普通日志
4. 错误消息

更合理的做法是：

1. 运行 `git clone` / `git fetch` 时临时注入凭据
2. clone 完成后 remote 仍保持无凭据 URL
3. 后续需要 fetch 时再次按需换取临时 token

## 6. 推荐产品形态

### 6.1 第一阶段只支持“私有内部 GitHub App”

Harbor 第一阶段建议：

1. GitHub App 设为私有
2. 仅供 Harbor 部署方或受信任团队安装
3. 不考虑 Marketplace
4. 不把 GitHub App 用作用户登录方式

这样做的好处是：

1. 心智更简单
2. 权限面更可控
3. 不需要先处理开放分发与第三方接入复杂性

### 6.2 个人开发者与小团队都适用

同一个私有 GitHub App 可以服务两类场景：

1. 安装到个人账号
   - 适合个人开发者
   - Harbor 可访问该个人账号授权给 App 的仓库
2. 安装到组织
   - 适合团队
   - Harbor 可访问该组织安装范围内授权给 App 的仓库

这意味着：

1. 个人开发者不需要手动粘贴 PAT 才能用私有 repo
2. 团队也不需要共用某个成员的 SSH key
3. Harbor 统一走 installation token 流程即可

## 7. GitHub App 最小配置建议

### 7.1 App 定位

推荐把这个 App 定位成：

```text
Harbor Repository Access App
```

职责只包含：

1. 列出可访问仓库
2. 读取仓库 metadata
3. 换取 installation token
4. 供 Harbor clone / fetch 私有仓库

### 7.2 最小权限建议

如果第一阶段目标只是“列仓库 + clone/fetch + 读取默认分支信息”，推荐从最小权限开始：

1. Repository metadata: `Read-only`
2. Repository contents: `Read-only`

第一阶段不建议默认申请：

1. Pull requests: write
2. Issues: write
3. Administration: write
4. Checks: write
5. Members: read/write

只有当 Harbor 后续真的需要：

1. 创建 PR
2. 写提交状态
3. 自动评论
4. 管理 webhook / branch protection

再单独扩权限。

### 7.3 Webhook 建议

第一阶段可以有两种落地策略：

1. 无 webhook
   - 更快落地
   - 适合先验证 clone/fetch 主线
2. 开 webhook
   - 便于感知 installation 被删除、仓库授权范围变化、repo 重命名等事件

建议：

```text
MVP 可以先不依赖 webhook，
但数据模型和模块边界应允许后续自然接入 webhook。
```

## 8. Harbor 模块边界建议

### 8.1 `auth` 模块职责不变

`auth` 继续负责：

1. GitHub OAuth 登录
2. Harbor session 创建与校验
3. 当前用户解析

`auth` 不负责：

1. GitHub App installation 生命周期
2. 仓库可见性查询
3. clone / fetch 凭据换取

### 8.2 建议新增 `integration/github` 或 `repository-access` 模块

推荐新增一个专门模块，职责如下：

1. 管理 GitHub App installation 记录
2. 按 installation 查询可访问 repo
3. 生成 installation token
4. 校验 project 与 installation/repo 绑定是否合法
5. 提供 clone/fetch 需要的临时访问上下文

可以有两种命名方式：

1. `integration/github`
   - 优点：贴合 provider
   - 缺点：未来多 provider 时容易继续膨胀
2. `repository-access`
   - 优点：贴合业务能力
   - 缺点：第一阶段实现仍然强耦合 GitHub

我倾向于第一阶段先采用：

```text
modules/integration/github
```

因为当前 Harbor 还没有第二个代码托管 provider，过早抽象容易空转。

### 8.3 `project` 继续拥有 project identity，但不拥有 provider secret

`project` 负责：

1. 这个项目是不是 git source
2. 这个项目绑定的是哪个 repo
3. 这个项目是否已经有本地 workspace

`project` 不负责：

1. 保存 provider secret
2. 直接换取 installation token
3. 解析 GitHub App JWT

### 8.4 `git` 继续只接 path

即使未来支持 GitHub App，`git` module 仍应只接收：

1. 本地路径
2. branch / diff / checkout 输入

所有“如何拿到这个本地路径”的逻辑，应停留在更外层的 orchestration / provision flow。

## 9. 领域模型建议

### 9.1 顶层判断

Harbor 现在已经有：

1. `Project.source`
2. `Project.rootPath`
3. `Project.normalizedPath`

这套模型可以继续保留。

新增能力不应强行把所有 GitHub App 字段塞进 `Project` 表，而应把“项目定义”和“外部集成绑定”拆开。

### 9.2 建议新增 `GitHubAppInstallation`

推荐新增一张 installation 级表：

```ts
GitHubAppInstallation {
  id: string
  providerInstallationId: string
  accountType: "user" | "organization"
  accountLogin: string
  targetType: "selected" | "all"
  status: "active" | "suspended" | "deleted"
  installedByUserId: string | null
  createdAt: Date
  updatedAt: Date
  lastValidatedAt: Date | null
}
```

这张表表达的是：

1. Harbor 认得哪个 GitHub installation
2. 这个 installation 安装在谁名下
3. 当前在 Harbor 中是否仍被视为有效

注意：

1. 不保存 installation token
2. 不保存用户 OAuth token

### 9.3 建议新增 `ProjectRepositoryBinding`

推荐为 git project 引入一张 1:1 绑定表：

```ts
ProjectRepositoryBinding {
  projectId: string
  provider: "github"
  installationId: string
  repositoryNodeId: string | null
  repositoryOwner: string
  repositoryName: string
  repositoryFullName: string
  repositoryUrl: string
  defaultBranch: string | null
  visibility: "public" | "private" | "internal" | null
  createdAt: Date
  updatedAt: Date
  lastVerifiedAt: Date | null
}
```

它的职责是表达：

1. 这个 Harbor project 对应哪个外部仓库
2. 该仓库由哪个 installation 授权访问
3. 当前 Harbor 记录里最后一次确认到的 repo 元信息

### 9.4 project 自身字段只保留 workspace 语义

`Project` 本身建议仍然保持：

1. `source.type = "git"`
2. `source.repositoryUrl`
3. `source.branch`
4. `rootPath = null | local path`
5. `normalizedPath = null | local canonical path`

也就是说：

1. `Project` 描述“项目引用”和“当前 workspace 是否存在”
2. `ProjectRepositoryBinding` 描述“访问这个 repo 的外部授权绑定”

### 9.5 是否需要单独的 workspace 状态字段

推荐增加一组更明确的 workspace 状态，而不要只依赖 `rootPath === null` 做隐式判断。

最小可行表达：

```ts
ProjectWorkspaceState =
  | "unprovisioned"
  | "provisioning"
  | "ready"
  | "sync_failed"
```

如果不想第一版就改动 `Project` 主表太多，也至少要在应用层统一定义这几个语义，避免业务逻辑散落在 `rootPath` null 判断上。

## 10. 关键流程设计

### 10.1 流程一：连接 GitHub App

目标：

```text
让 Harbor 知道有哪些 installation 可以用于后续 repo access。
```

推荐流程：

1. Harbor 用户先通过 GitHub OAuth 登录 Harbor
2. 用户在 Harbor 中点击“连接 GitHub 仓库”
3. Harbor 返回 GitHub App 安装入口 URL
4. 用户在 GitHub 完成安装或选择已有 installation
5. GitHub 回跳 Harbor
6. Harbor 记录 `GitHubAppInstallation`
7. Harbor 显示该 installation 下可访问的 repo 列表

注意：

1. 这里的 Harbor 登录用户只是“触发者”
2. 真正的 repo access 权限来自 GitHub App installation，不来自 OAuth session

### 10.2 流程二：创建 git project 并绑定 repo

目标：

```text
创建一个 git source project，
并把它和某个 installation 下的具体仓库绑定起来。
```

推荐流程：

1. 用户选择某个 installation
2. Harbor 列出该 installation 可访问的仓库
3. 用户选择 repo 和默认 branch
4. Harbor 创建 `Project`
5. Harbor 创建 `ProjectRepositoryBinding`
6. `Project.rootPath` / `normalizedPath` 暂时仍可为 `null`

这样做的好处是：

1. project identity 可以先创建
2. workspace provision 可以后置
3. GitHub 授权绑定和本地目录创建不必强耦合在一个事务里

### 10.3 流程三：provision local workspace

目标：

```text
为 git project 真正生成本地工作目录。
```

推荐流程：

1. 调用 project-scoped provision API
2. 应用层读取 `ProjectRepositoryBinding`
3. 应用层通过 installation 换取短期 token
4. workspace provisioner 在受控目录下创建本地 workspace
5. provisioner 调用 `git clone`
6. clone 成功后更新 `Project.rootPath` / `normalizedPath`
7. 将 workspace state 标记为 `ready`

关键点：

1. 受控目录必须由 Harbor 服务端决议，不由前端传入任意绝对路径
2. git credential 只在 clone 命令运行时临时注入
3. clone 成功后本地 remote 不应保存明文 token

### 10.4 流程四：后续 fetch / refresh

目标：

```text
在已有本地 workspace 的情况下刷新远端状态。
```

推荐流程：

1. 外层 project flow 校验当前用户是否有权操作该 project
2. 读取 project 绑定的 installation 与 repo
3. 动态换取 installation token
4. 调用受控 `git fetch`
5. 更新最后同步时间、错误状态或 project health

`git` module 本身仍只看到：

1. 本地 path
2. 受控执行的 git command

## 11. API 设计建议

### 11.1 集成级接口

第一阶段建议最少提供：

1. `GET /v1/integrations/github/app/install-url`
2. `GET /v1/integrations/github/installations`
3. `GET /v1/integrations/github/installations/:installationId/repositories`

语义如下：

1. `install-url`
   - 返回引导用户去 GitHub 完成 App 安装的 URL
2. `installations`
   - 返回 Harbor 当前可见的 installation 列表
3. `repositories`
   - 返回某个 installation 下 Harbor 当前可访问的 repo 列表

### 11.2 project 接口扩展

第一阶段建议补充：

1. `POST /v1/projects`
   - 创建 git project 时允许带 repo binding 信息
2. `POST /v1/projects/:id/provision-workspace`
   - 为 git project 触发首次 clone
3. `POST /v1/projects/:id/sync`
   - 对已有 workspace 做 fetch / refresh
4. `GET /v1/projects/:id/repository-binding`
   - 返回项目当前 repo 绑定与 workspace 状态

创建 git project 的请求体可以演化成：

```json
{
  "id": "project-1",
  "name": "Harbor Assistant",
  "source": {
    "type": "git",
    "repositoryUrl": "https://github.com/acme/harbor-assistant.git",
    "branch": "main"
  },
  "repositoryBinding": {
    "provider": "github",
    "installationId": "inst_123",
    "repositoryFullName": "acme/harbor-assistant"
  }
}
```

说明：

1. `source` 仍描述项目本身
2. `repositoryBinding` 描述 Harbor 如何合法访问这个 repo

### 11.3 是否允许“无绑定 git project”

建议允许，但语义要非常明确：

1. 有些 `git` source project 只是导入了 repo URL，还未完成授权绑定
2. 这类项目可存在，但不能 provision workspace，也不能执行需要远端访问的操作

这样可支持更平滑的 onboarding：

1. 先建项目
2. 后连 installation
3. 再 provision

如果希望第一阶段更简单，也可以收紧为：

1. 所有私有 GitHub `git` project 在创建时必须同时完成 binding

我倾向于第一版先收紧，减少状态空间。

## 12. 安全设计要求

### 12.1 服务端 secret 管理

Harbor 服务端应安全保存：

1. `GITHUB_APP_ID`
2. `GITHUB_APP_PRIVATE_KEY`
3. `GITHUB_APP_WEBHOOK_SECRET`

这些值：

1. 不进入前端
2. 不进入普通 API 响应
3. 不进入 debug 日志

### 12.2 token 生命周期

installation token 应满足：

1. 按需创建
2. 仅用于当前操作
3. 默认不持久化到数据库
4. 不落盘到 project 配置
5. 不回显到错误消息

### 12.3 git 调用约束

clone / fetch 过程必须满足：

1. token 不能出现在 repo 持久化 URL 中
2. token 不能写入 `.git/config`
3. token 不能进入 structured logs
4. 失败时错误信息要先做脱敏

### 12.4 授权校验

任何 project-scoped repo 操作都至少要做两层校验：

1. Harbor 用户是否有权操作该 project
2. project 绑定的 installation 是否仍有权访问该 repo

### 12.5 installation 失效处理

如果 installation 被删除、仓库被移出授权范围、repo 被重命名或转移，应允许 Harbor 进入显式错误状态，例如：

1. `REPOSITORY_ACCESS_REVOKED`
2. `REPOSITORY_NOT_IN_INSTALLATION_SCOPE`
3. `PROJECT_WORKSPACE_SYNC_FAILED`

不要把这类错误伪装成普通 git 失败。

## 13. 替代方案评估

### 13.1 方案 A：扩大 GitHub OAuth scope，直接保存用户 OAuth token

优点：

1. 接入快
2. 不需要 GitHub App 安装流程

缺点：

1. 登录与 repo access 混淆
2. 服务端需持久化用户长期或中长期 token
3. 用户离开或 token 失效时系统稳定性差
4. 多用户团队场景下边界不清晰

结论：

```text
不推荐作为 Harbor 默认长期方案。
```

### 13.2 方案 B：用户手动提供 PAT

优点：

1. 简单直观
2. 便于单用户快速自托管

缺点：

1. Harbor 需要托管用户个人凭据
2. 凭据轮换、撤销、泄露风险都转嫁给 Harbor
3. 团队使用时审计与权限模型不稳

结论：

```text
可以作为 fallback，不推荐作为默认主线。
```

### 13.3 方案 C：服务器共用 SSH key

优点：

1. 本地开发或单人自用可快速工作
2. git 层接入成本低

缺点：

1. 凭据边界过粗
2. 多用户场景天然混淆身份
3. 一旦 key 泄露，影响范围往往不可控

结论：

```text
只适合单用户信任环境，不适合 Harbor 的团队服务目标。
```

### 13.4 方案 D：GitHub App

优点：

1. 权限边界更清晰
2. 基于 installation scope，而不是个人长期凭据
3. 适合个人账号和组织账号
4. 更适合作为 Harbor 的服务级能力

缺点：

1. 需要 App 安装流程
2. 初始实现复杂度高于 PAT/SSH key
3. 需要服务端安全管理 App private key

结论：

```text
这是 Harbor 的推荐主方案。
```

## 14. 分阶段落地建议

### 14.1 Phase 1: 最小可用

目标：

1. GitHub App 安装
2. installation 列表
3. repo 列表
4. git project 绑定 repo
5. 首次 clone
6. 手动 fetch / sync

不做：

1. webhook 驱动状态同步
2. 自动重试
3. PR 写入
4. 多 provider 抽象

### 14.2 Phase 2: 稳定化

目标：

1. webhook 接入 installation lifecycle
2. repo scope 变更检测
3. repo rename / transfer 处理
4. background sync / health refresh
5. 更明确的 workspace state 与错误恢复 UI

### 14.3 Phase 3: 扩展能力

可选扩展：

1. pull request read/write
2. branch automation
3. commit status / checks
4. 多 provider 支持

## 15. 最终结论

Harbor 当前阶段的正确方向不是：

```text
把 GitHub 私有仓库访问继续塞进 GitHub OAuth 登录流程。
```

而是：

```text
GitHub OAuth 继续只负责 Harbor 登录。
GitHub App 单独负责私有仓库访问授权。
Project 持有项目身份与 repo 绑定。
Workspace provision flow 负责把远端 repo 变成本地路径。
Git module 继续只负责本地 path 上的 git 语义。
```

这条路径的好处是：

1. 不破坏现有 auth 边界
2. 不让 Harbor 默认持有用户个人长期凭据
3. 与现有 `project source = git` 模型自然兼容
4. 允许个人开发者与小团队共用同一套能力模型

如果 Harbor 要把“git project”从“仓库引用”真正升级为“可受控访问、可 provision、本地可运行”的项目形态，那么 GitHub App 是当前最稳妥的主线设计。
