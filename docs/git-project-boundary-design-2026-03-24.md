# Git / Project Boundary Design

## 1. 文档信息

- 文档名称：Git / Project Boundary Design
- 日期：2026-03-24
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/git`
  - `apps/service/src/modules/project`
  - 已移除的早期 git 实现，仅作为迁移背景
  - future `interaction` 对 project git realtime 的消费边界
- 关联文档：
  - [backend-lite-ddd-design-2026-03-24.md](./backend-lite-ddd-design-2026-03-24.md)
  - [project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
  - [product-prd-2026-04-10.md](./product-prd-2026-04-10.md)
  - [tdd/project.md](./tdd/project.md)

## 2. 文档目标

这份文档只回答两个问题：

1. `git` 和 `project` 之间应该怎么分边界
2. 当前系统从旧实现迁到新实现时该怎么走

这里不讨论：

1. MCP server
2. 项目设置页 UI
3. task runtime policy

也不试图一次性重写 `git` 模块。

## 3. 现状判断

当前仓库里，旧 `git` 实现已经移除；本文只保留它的接线方式作为边界分析样本。

它的核心接线方式是：

1. `git` service 直接依赖旧 `project` repository
2. 通过 `projectId -> getProjectById(projectId) -> project.path`
3. 拿到 path 后再继续做：
   - repo root detection
   - branch query
   - diff query
   - checkout / create branch
   - project git watcher

最直接的耦合点，来自那一版旧实现的设计方式：

1. `git` 入口直接拿 `project repository`
2. `route` 层没有把 `projectId -> rootPath` 的转换停留在外层
3. watcher 与 git query 都混在同一个旧实现模块里

这种实现目前能工作，但它不符合新设计的边界要求。

## 4. 当前问题

### 4.1 `git` 直接依赖旧式 `project` repository

这意味着：

1. `git` 不能独立演进
2. `project` 存储结构一变，`git` 就会被动跟着变
3. `project` 和 `git` 的 read boundary 没有真正分离

### 4.2 `git` 读取的是 `project.path` 这种旧字段语义

而新的 `project` 聚合里，路径语义应当明确为：

1. `rootPath`
2. `normalizedPath`

旧 `path` 只是兼容别名，不应该继续成为新 `git` 模块的正式依赖。

### 4.3 watcher 直接绑在项目路径上，但边界表达不清楚

当前 watcher 的业务意思其实是：

1. “订阅某个项目的 git 变化”
2. 但执行上是“监听该项目 root path 下和 `.git` 相关的变化”

这个语义没错，但 owner 和接线方式还不够清晰。

### 4.4 `git` 当前更像“读取 project 然后顺手做 git”

这会带来一个隐含问题：

`git` 容易继续向 `project` 借更多字段，而不是建立自己的明确输入边界。

## 5. 目标边界

### 5.1 `project` 负责什么

`project` 负责：

1. `projectId` 是否存在
2. 项目的业务状态
3. 项目的根目录语义
4. 该项目是否可被视为“可操作项目”

它不负责：

1. git repo root detection
2. branch / diff / checkout 语义
3. watcher 语义
4. git command error parsing

### 5.2 `git` 负责什么

`git` 负责：

1. 判断某路径是否位于 git repository 中
2. 解析 repository root
3. 读取 branch / status / diff
4. checkout / create branch
5. path-scoped git watcher

它不负责：

1. 决定项目是否存在
2. 决定项目业务生命周期
3. 决定项目默认设置
4. 持久化 `Project`

### 5.3 最核心的一句话

```text
Project owns project identity and root-path semantics.
Git is a path-based wrapper around repository semantics.
```

## 6. 推荐依赖方向

目标依赖方向应当是：

```text
git module
  -> git repository / git command adapter
```

而不是：

```text
git
  -> project
```

也就是说，新的 `git` module 本体应该完全和 `project` 解耦。

如果系统需要 project-scoped git API，那属于更外层的编排问题，而不是 `git` module 自身职责。

## 7. 推荐协作模型

### 7.1 `git` module 只接收 path

新的 `git` module 不应该再接收：

1. `projectId`
2. `ProjectRepository`
3. `ProjectQuery`
4. `ProjectGitLocator`

它真正需要的输入应该只有：

1. `projectPath`
2. `repositoryPath`

也就是这种形式：

```ts
gitService.getRepositorySummary({ path })
gitService.listBranches({ path })
gitService.getDiff({ path })
gitService.checkoutBranch({ path, branchName })
gitService.createBranch({ path, branchName, checkout, fromRef })
```

### 7.2 project-scoped 是外层 facade 的事情

当前旧实现只真正需要一件事：

1. 外部接口是 `/projects/:projectId/git/...`
2. 但内部执行真正需要的是 path

所以推荐拆成两层：

```text
project-scoped facade / route adapter
  -> project module: resolve projectId -> rootPath
  -> git module: operate on path
```

这里的关键判断是：

1. project-scoped 是 API 视角
2. path-based 是 git module 视角
3. 不要把 API scope 误当成 git module 的领域输入

### 7.3 `git` 只对 path 决策

`git` 在拿到 path 后自行决定：

1. 是否允许继续执行 git query
2. 如何检查 repo root
3. 如果不是 repo，该抛什么 git 错误

这条规则很重要：

“项目存在”不等于“该路径一定是 git repo”

这个判断必须由 `git` 自己做，而不是由 `project` 代做。

## 8. `project` 和 `git` 的错误边界

推荐错误分层如下：

### 8.1 外层 project-scoped facade 负责抛

1. `PROJECT_NOT_FOUND`
2. `INVALID_PROJECT_ID`
3. future `INVALID_PROJECT_STATE`

### 8.2 `git` 负责抛

1. `GIT_REPOSITORY_NOT_FOUND`
2. `GIT_BRANCH_NOT_FOUND`
3. `GIT_BRANCH_ALREADY_EXISTS`
4. `GIT_WORKTREE_DIRTY`
5. `GIT_NOT_AVAILABLE`
6. `GIT_READ_FAILED`
7. `GIT_CHECKOUT_FAILED`
8. `GIT_CREATE_BRANCH_FAILED`

关键原则：

外层 facade 负责“项目有没有、项目能不能被找到”；`git` 负责“这个路径是不是 git repo、git 能不能操作成功”。

## 9. project git watcher 应该怎么理解

`project git watcher` 容易让人误解成“这是 project 的职责”，其实不是。

它的正确理解是：

1. topic 是 `project:{projectId}`
2. 但变化语义属于 `git`
3. watcher 本体属于 `git` context
4. `interaction` 或 websocket 只负责订阅与投递

更准确的说法应该是：

更进一步说，`git` 自己只应该有 path-scoped watcher。

如果系统里出现 `project:{projectId}` 这种订阅语义，那是外层 facade / interaction 的命名，不是 `git` module 本体的命名。

这个命名差异很关键，因为 owner 不一样。

## 10. 当前 API 归属判断

当前旧 git API 形态大致是：

1. `GET /projects/:projectId/git`
2. `GET /projects/:projectId/git/branches`
3. `GET /projects/:projectId/git/diff`
4. `POST /projects/:projectId/git/checkout`
5. `POST /projects/:projectId/git/branches`

这套 API 路径是可以保留的，但要明确：

1. 它们的资源 scope 是 project-scoped
2. 它们的语义 owner 是 `git`
3. 不能因为路径上挂了 `/projects/:id/...` 就把逻辑塞回 `project`

所以这里推荐继续保留 project-scoped route path，但内部实现归属 `git` module。

更准确地说：

1. URL 可以继续是 project-scoped
2. 但 handler 内部应先把 `projectId` 解析成 path
3. 然后再调用纯 path-based `git` service

## 11. 对新 `project` 模块的影响

新的 `project` 模块当前已经具备：

1. 新聚合
2. 新 application use cases
3. 新 Prisma repository
4. 新 route schema 和错误模型

但这并不意味着 `project` 现在必须给 `git` 暴露正式 query boundary。

接下来不要做的事是：

1. 让新的 `git` module import 新 `PrismaProjectRepository`
2. 让新的 `git` module 依赖任何 `project` query port

正确做法是：

1. 新的 `git` module 只做 path-based wrapper
2. 如果保留 `/projects/:id/git/...`，就在 route 或 facade 层先 resolve `projectId -> path`

## 12. 推荐的新模块结构

如果开始重建新的 `git` 模块，建议目标形态是：

```text
modules/git/
├── application/
│   ├── queries/
│   ├── commands/
├── domain/
│   ├── git.errors.ts
│   └── git.types.ts
├── infrastructure/
│   ├── git-command-repository.ts
│   └── path-git-watcher.ts
├── routes/
├── schemas/
└── index.ts
```

## 13. 推荐迁移顺序

### Phase 1

先写文档并固定边界：

1. `git` 不再依赖旧 `project` repository 实现
2. `git` 不依赖任何 `project` 边界

### Phase 2

重建新的 `modules/git`

先把 service 输入改成 path-based：

1. `getRepositorySummary({ path })`
2. `listBranches({ path })`
3. `getDiff({ path })`
4. `checkoutBranch({ path, branchName })`
5. `createBranch({ path, branchName, ... })`

### Phase 3

再做 project-scoped facade：

1. 保留 `/projects/:projectId/git/...` 路由语义
2. 在 handler 或 facade 层先 resolve `projectId -> rootPath`
3. 再调用新的 path-based `git` service

### Phase 4

最后再迁 watcher：

1. `PathGitWatcher`
2. project-scoped realtime facade
3. interaction subscription boundary

这样做的原因是：

watcher 比 query 更容易引入资源泄漏和行为复杂度，应该最后迁。

## 14. 风险判断

当前迁 `git` 最大的风险不是 diff 逻辑，而是边界混乱。

主要风险有：

1. 继续让 `git` 直接依赖 `project` persistence implementation
2. 继续让 `git` 依赖任何 project query boundary
3. 继续沿用 `project.path` 这种旧兼容字段语义
4. 提前迁 watcher，导致资源管理问题先爆出来
5. 把 repo 存在性判断错误地塞进 `project`

## 15. 最终结论

这份文档的核心结论可以收敛成三句话：

```text
Project owns project identity and root-path truth.
Git is a path-based wrapper around repository operations.
Project-scoped git APIs are an orchestration concern, not a git-module concern.
```

进一步展开就是：

1. `git` module 只接受 path，不接受 `projectId`
2. `git` 自己负责 repo 检测、diff、branch、checkout 和 watcher
3. 如果继续保留 `/projects/:id/git/...`，那只是外层 facade / route adapter 的职责

只要后续迁移还能守住这三点，`git` 和 `project` 的边界就不会再次塌回旧实现的耦合模式。
