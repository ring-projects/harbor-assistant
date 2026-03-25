# Git TDD 红绿灯计划

## 1. 文档信息

- 文档名称：Git TDD 红绿灯计划
- 日期：2026-03-24
- 状态：Proposed
- 适用范围：
  - `git` context
  - `apps/service/src/modules/git`
- 关联文档：
  - [../git-project-boundary-design-2026-03-24.md](../git-project-boundary-design-2026-03-24.md)
  - [../backend-lite-ddd-design-2026-03-24.md](../backend-lite-ddd-design-2026-03-24.md)

## 2. 目标

这份文档只规划新的 `git` module 如何按 TDD 推进，不讨论 `project` 聚合，也不讨论 websocket 或 interaction 实现。

核心目标有三个：

1. 把 `git` 收敛成纯 path-based wrapper
2. 用测试先固定 git 查询与命令语义
3. 把 project-scoped API 编排留到 `git` module 之外

这里默认采用的设计前提是：

1. `git` module 不接受 `projectId`
2. `git` module 不依赖 `project`
3. `git` module 只接受 `path`

## 3. TDD 总原则

新的 `git` module 必须坚持一条底线：

先定义 git 语义测试，再写实现。

推荐顺序：

1. parser / domain-like helper tests
2. application service tests
3. command repository integration tests
4. project-scoped facade tests（如后续仍然保留）
5. HTTP route tests（仅在 API 形态稳定后补）

不建议的顺序：

1. 先从 `/projects/:id/git/...` 开始写
2. 先让 `git` 依赖 `project` 再慢慢拆
3. 先把 watcher 接上再补 query/command 测试

原因很简单：

`git` 的核心复杂度不在项目身份，而在 git 输出解析、错误映射和命令语义。

## 4. 每一轮红绿灯怎么执行

后续每个 git use case 都按同一模板推进，不允许跳步：

### 4.1 红灯

先写一个失败测试，只表达一个明确语义：

1. 输入是什么
2. 依赖返回什么 stdout / stderr / exitCode
3. 期望返回什么结构化结果或错误

红灯阶段的要求：

1. 先失败，且失败原因清晰
2. 一次只锁一个行为
3. 不为了“顺手通过”而提前实现额外逻辑

### 4.2 绿灯

再补最小实现让测试通过：

1. 只写让当前失败测试变绿所需的最小代码
2. 不提前抽象未来接口
3. 不在这一轮顺手做 route / facade / watcher

### 4.3 重构

测试变绿之后，再做必要重构：

1. 消除重复 parser 逻辑
2. 收紧错误分类
3. 收紧命名
4. 保持对外 contract 不变

重构阶段不允许：

1. 扩展边界
2. 引入 `projectId`
3. 把 facade 逻辑塞回 `git` module

## 5. 测试分层

### 5.1 Parser / helper tests

测试对象：

1. branch 输出解析
2. current branch 解析
3. dirty 状态解析
4. unified diff 解析
5. git stderr 分类判断

这一层应该尽量纯函数化，不碰：

1. Fastify
2. Prisma
3. `project`
4. 真实数据库

### 5.2 Application tests

测试对象：

1. `GetRepositorySummary`
2. `ListBranches`
3. `GetDiff`
4. `CheckoutBranch`
5. `CreateBranch`

这一层验证：

1. 输入是 `path`
2. service 如何调用 git repository
3. stderr / exit code 如何映射为结构化 git 错误
4. 不同 git 场景下返回什么结果

### 5.3 Repository integration tests

测试对象：

1. git command adapter
2. 在真实临时仓库上的命令执行
3. diff / branch / checkout 的真实行为

这一层只验证：

1. 命令是否真的跑通
2. stdout/stderr 是否与 parser 假设一致
3. 跨平台兼容假设是否成立

### 5.4 HTTP route tests（后置可选）

这一层当前不是第一轮核心范围。

只有在下面条件成立时才建议补：

1. path-based API 需要长期稳定对外
2. route 层有独立 schema / coercion / error mapping 价值
3. 上层不会很快废弃这组接口

测试对象：

1. path-based git routes
2. request schema / validation
3. response contract

注意：

如果后续保留 `/projects/:id/git/...` 这种接口，这一层应该拆成两类：

1. `git` module 自己的 path-based routes
2. 外层 project-scoped facade routes

### 5.5 Facade tests

测试对象：

1. `projectId -> rootPath` 的编排
2. 读取 project 后转调 path-based git service
3. `PROJECT_NOT_FOUND` 与 git 错误的边界分层

这层不属于 `git` module 本体，但必须单独测试，不要混进 `git` 内核测试中。

## 6. 红绿灯开发节奏

这里的“红绿灯”是指每一阶段都要遵守：

1. 先写失败测试
2. 再补最小实现让测试变绿
3. 最后做必要重构，不扩边界

### 6.1 第一盏灯：纯解析逻辑

先写红灯测试：

1. 能从 `git branch --list` 输出解析出 branches
2. 能从 `git branch --show-current` 输出解析 current branch
3. 能从 `git status --short --branch` 判断 dirty
4. 能识别 “not a git repository”
5. 能识别 “git not found”

变绿目标：

1. helper / parser 纯函数通过
2. 不引入 service / repository 依赖

### 6.2 第二盏灯：path-based queries

先写红灯测试：

1. `GetRepositorySummary(path)` 在正常仓库返回 summary
2. 非仓库路径返回 `GIT_REPOSITORY_NOT_FOUND`
3. git 不可用返回 `GIT_NOT_AVAILABLE`
4. `ListBranches(path)` 返回 current branch + branches
5. `GetDiff(path)` 返回结构化 diff

变绿目标：

1. service 输入只有 path
2. service 不认识 `projectId`
3. service 错误全部收敛成 git 错误

### 6.3 第三盏灯：path-based commands

先写红灯测试：

1. `CheckoutBranch(path, branchName)` 成功切换分支
2. 不存在分支返回 `GIT_BRANCH_NOT_FOUND`
3. dirty worktree 返回 `GIT_WORKTREE_DIRTY`
4. `CreateBranch(path, branchName)` 成功创建分支
5. 重复分支返回 `GIT_BRANCH_ALREADY_EXISTS`

变绿目标：

1. 命令路径清晰
2. 错误映射稳定
3. 不把 branch name 校验散落到 route

### 6.4 第四盏灯：真实仓库集成

先写红灯测试：

1. 临时 git 仓库上能读 summary
2. 临时 git 仓库上能 list branches
3. 修改文件后 `GetDiff` 可读
4. checkout / create branch 在真实仓库中通过

变绿目标：

1. command adapter 稳定
2. parser 假设和真实 git 输出一致

### 6.5 第五盏灯：project-scoped facade

这一盏灯只在外层仍保留 `/projects/:id/git/...` 时才存在。

先写红灯测试：

1. `/projects/:id/git/...` 先查 project，再调 path-based git service
2. `projectId` 不存在时返回 `PROJECT_NOT_FOUND`
3. 项目存在但不是 repo 时返回 git 错误，而不是 project 错误

变绿目标：

1. project-scoped facade 成立
2. `git` module 本体仍然完全不知道 `project`

### 6.6 第六盏灯：HTTP contract（仅在 API 稳定后补）

这一盏灯必须放最后，而且默认可跳过。

先写红灯测试：

1. path-based git route 返回正确 response
2. branch body 非法时 request validation 失败
3. diff route response shape 稳定

变绿目标：

1. schema 正常工作
2. route 只是接线，不做业务判断
3. route 测试数量保持最小，不重复证明 git 语义

## 7. 第一批优先开发项

建议先做下面这条最小路径：

1. `GetRepositorySummary(path)`
2. `ListBranches(path)`
3. `GetDiff(path)`

原因：

1. 这三项都是 query
2. 它们风险比 checkout / create branch 低
3. 它们已经能支撑大部分只读 UI 和调试能力

第一批不要急着做：

1. watcher
2. websocket
3. project-scoped facade
4. clone / bootstrap from remote
5. HTTP contract

## 8. 分阶段验收清单

### 8.1 第一阶段验收

1. parser 测试全部先红后绿
2. 出现第一版 `GitError` 分类
3. 还没有真实 git 命令执行，也不阻塞进入下一阶段

### 8.2 第二阶段验收

1. `GetRepositorySummary(path)` 通过
2. `ListBranches(path)` 通过
3. `GetDiff(path)` 通过
4. 所有输入都是 `path`

### 8.3 第三阶段验收

1. `CheckoutBranch(path, branchName)` 通过
2. `CreateBranch(path, branchName, ...)` 通过
3. branch 相关错误都有测试

### 8.4 第四阶段验收

1. 至少一组真实临时仓库集成测试通过
2. parser 假设经过真实 git 输出校验
3. command adapter 不再只是 fake

### 8.5 第五阶段验收

1. 如需 `/projects/:id/git/...`，它被单独视为 facade
2. facade 测试里才出现 `projectId`
3. `git` module 本体仍不依赖 `project`

### 8.6 第六阶段验收

1. path-based route schema 稳定
2. request validation 覆盖非法 body / query / path
3. route 本身不含 git 语义判断

## 9. 测试文件组织建议

推荐结构：

```text
apps/service/src/modules/git/
  domain/
    __tests__/
      branch-parser.test.ts
      status-parser.test.ts
      diff-parser.test.ts
  application/
    __tests__/
      get-repository-summary.test.ts
      list-branches.test.ts
      get-diff.test.ts
      checkout-branch.test.ts
      create-branch.test.ts
  infrastructure/
    __tests__/
      git-command-repository.test.ts
      path-git-watcher.test.ts
  routes/
    __tests__/
      git.routes.test.ts
      project-git-facade.routes.test.ts
```

如果当前目录结构还没重建完，也建议至少在测试命名和分层上保持这个意图。

## 10. Fake / Stub 策略

### 8.1 application tests

建议用 fake command repository：

1. 不跑真实 git
2. 直接返回预设 stdout / stderr / exitCode
3. 只验证 service 的语义判断

### 8.2 integration tests

建议用真实临时仓库：

1. 初始化 temp git repo
2. 创建文件与分支
3. 调用真实 command adapter

### 8.3 不建议

不建议在 application tests 中：

1. 直接 exec 真实 git
2. 直接查 project
3. 混入 websocket / watcher 副作用

## 11. 错误模型测试要求

新的 `git` module 至少要把这些错误写成测试：

1. `GIT_REPOSITORY_NOT_FOUND`
2. `GIT_BRANCH_NOT_FOUND`
3. `GIT_BRANCH_ALREADY_EXISTS`
4. `GIT_WORKTREE_DIRTY`
5. `GIT_NOT_AVAILABLE`
6. `GIT_READ_FAILED`
7. `GIT_CHECKOUT_FAILED`
8. `GIT_CREATE_BRANCH_FAILED`

关键点：

这些错误应该全部由 `git` module 自己稳定产出，而不是留给 route 或外层调用方去猜。

## 12. 和 `project` 的测试边界

新的 `git` TDD 必须守住一条规则：

`git` module 的测试里，不出现 `projectId`。

一旦某个测试需要 `projectId`，那它已经不是 `git` module 本体测试，而是 facade / orchestration 测试。

这个规则非常重要，因为它能防止 `git` 再次长回旧实现的耦合形态。

## 13. 建议开发顺序

推荐顺序：

1. 先补 parser tests
2. 再补 path-based query service tests
3. 再补 path-based command service tests
4. 再做真实 git repository integration tests
5. 如果仍保留 project-scoped API，再单独做 facade tests
6. 只有在 API 形态稳定后，再补最小规模的 path-based HTTP route tests

如果顺序反过来，很容易再次把 `git` 和 `project` 缠在一起。

## 14. 第一轮验收标准

如果第一轮 TDD 做完，至少应该满足：

1. `git` module 本体完全不依赖 `project`
2. 所有 service 输入都基于 path
3. query / command 都有结构化错误测试
4. 至少一组真实临时仓库 integration tests 通过

第一轮不要求：

1. HTTP route tests
2. request validation tests
3. `/projects/:id/git/...` facade tests

## 15. 第一轮之外的延后项

这份规划当前不覆盖：

1. project memory
2. task diff enrichment
3. websocket delivery
4. git clone from remote bootstrap

这些能力后续可以基于 `git` 的 path-based wrapper 再往上组合。

如果后续要支持“目录下没有仓库时，从 remote 初始化”，建议单独作为第二阶段扩展能力处理，而不是混入第一轮 `git` 核心语义里。因为它引入的是另一组命令语义：

1. remote URL 校验
2. clone / init / fetch 的错误模型
3. 凭证与权限问题
4. 初始化后的 project / git 编排

## 16. 最终结论

新的 `git` TDD 规划只有一个核心原则：

```text
Path first, git semantics first, facade later.
```

展开就是：

1. 先把 `git` 做成纯 path-based wrapper
2. 先验证 git 语义，再做 project-scoped 接口编排
3. 把 `projectId -> path` 的逻辑永远留在 `git` module 外层

只要守住这条顺序，新的 `git` module 就不会再次退化成旧实现那种“项目查询 + git 执行”混杂在一起的形态。
