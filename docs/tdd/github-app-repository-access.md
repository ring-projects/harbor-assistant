# GitHub App Repository Access TDD Plan

## 1. 文档信息

- 文档名称：GitHub App Repository Access TDD Plan
- 日期：2026-04-02
- 状态：Proposed
- 适用范围：
  - `apps/service/src/modules/project`
  - future `apps/service/src/modules/integration/github`
  - future project-scoped workspace provision / sync flow
- 关联文档：
  - [../github-app-repository-access-design-2026-04-02.md](../github-app-repository-access-design-2026-04-02.md)
  - [../project-dual-source-requirements-2026-04-02.md](../project-dual-source-requirements-2026-04-02.md)
  - [../git-project-boundary-design-2026-03-24.md](../git-project-boundary-design-2026-03-24.md)
  - [../auth-user-service-design-2026-04-01.md](../auth-user-service-design-2026-04-01.md)

## 2. 目标

这份文档定义 GitHub App 私有仓库访问方案的第一轮 TDD 推进方式。

本轮目标不是一次性实现完整 GitHub 平台集成，而是先做出一条最小但完整的后端闭环：

1. Harbor 能暴露 GitHub App 安装入口
2. Harbor 能读取 installation 列表
3. Harbor 能读取 installation 下的仓库列表
4. Harbor 能在创建 git project 时绑定一个 GitHub 仓库
5. Harbor 能查询项目当前的 repository binding
6. Harbor 能对绑定仓库的项目执行首次 workspace provision
7. Harbor 能对已有 workspace 执行 sync

这里的关键不是“先把所有 GitHub API 都接上”，而是：

```text
先通过测试锁定 Harbor 内部的边界、状态和行为，
再让 GitHub API、Prisma、Fastify 作为外层实现去满足它。
```

## 3. 本轮实现边界

### 3.1 纳入实现

本轮纳入实现的能力：

1. `integration/github` 模块雏形
2. GitHub App 配置项读取
3. installation / repository 查询接口
4. `ProjectRepositoryBinding` 持久化
5. 创建 git project 时保存 binding
6. 查询项目 binding
7. workspace provision use case
8. workspace sync use case
9. 针对私有 git project 的认证与授权接线

### 3.2 暂不实现

本轮不做：

1. webhook 驱动 installation 生命周期同步
2. background reconciliation
3. 自动重试机制
4. PR / checks / issue 等写能力
5. 多 provider 抽象
6. 复杂 RBAC

### 3.3 关键假设

为了控制范围，本轮先做以下假设：

1. 只有 `provider = github`
2. GitHub App 相关 secret 已由服务端配置
3. installation token 只在请求生命周期内使用，不落库
4. workspace 目录由 Harbor 服务端决议
5. `git` module 继续保持 path-based

## 4. TDD 总原则

推荐测试顺序：

1. domain / application tests
2. route tests
3. repository tests
4. composition-root integration tests

这里特意把 repository tests 放在 route tests 后面，不是因为持久化不重要，而是因为这次的核心复杂度在于：

1. 状态边界
2. route contract
3. use case 编排
4. provider 接口抽象

先把行为和 API 说清，再落 Prisma 映射，返工会更少。

## 5. 测试分层

### 5.1 Domain / application

先锁定以下业务行为：

1. 只有 `git` source project 才能绑定 repository access
2. 创建带 binding 的 git project 时必须同时提供合法 installation 与 repo identity
3. `rootPath` project 不能绑定 GitHub repo
4. 未绑定仓库的 git project 不能 provision / sync
5. 未 provision workspace 的 git project 不能 sync
6. provision 成功后会把 `rootPath` 与 `normalizedPath` 写回 project
7. sync 不改变 project identity，但会依赖现有 workspace

### 5.2 Route

先锁定以下 HTTP 合约：

1. `GET /v1/integrations/github/app/install-url`
2. `GET /v1/integrations/github/installations`
3. `GET /v1/integrations/github/installations/:installationId/repositories`
4. `POST /v1/projects` 支持 git project + repository binding
5. `GET /v1/projects/:id/repository-binding`
6. `POST /v1/projects/:id/provision-workspace`
7. `POST /v1/projects/:id/sync`

这层只验证：

1. request schema
2. response shape
3. owner-scoped project access
4. 错误码映射

### 5.3 Repository

这层只验证：

1. installation 记录读写
2. project repository binding 读写
3. project 删除时 binding 生命周期是否一致
4. owner-scoped project 查询不会越权返回 binding

### 5.4 Composition root

这层验证：

1. 新模块已接入 `registerV1Routes`
2. Prisma 存储、project route、integration route 三者已连通
3. 认证后可完整走通最小 happy path

## 6. 第一批红灯测试

建议第一批先写以下失败测试。

### 6.1 Integration route tests

先写：

1. 未配置 GitHub App 时，`install-url` 返回 `AUTH_NOT_CONFIGURED` 或等价配置错误
2. 已配置时，`install-url` 返回可用 URL
3. `installations` 返回 provider 安装列表
4. `repositories` 返回 installation 下可访问仓库列表

### 6.2 Project route tests

先写：

1. 创建 git project 时允许带 `repositoryBinding`
2. 创建 rootPath project 时若带 `repositoryBinding` 则失败
3. `GET /projects/:id/repository-binding` 可读取绑定信息
4. 未绑定时读取返回 `PROJECT_REPOSITORY_BINDING_NOT_FOUND` 或等价错误
5. `POST /projects/:id/provision-workspace` 对 git project 生效
6. `POST /projects/:id/sync` 在没有 workspace 时返回 `INVALID_PROJECT_STATE`

### 6.3 Application tests

先写：

1. `createProjectWithRepositoryBinding` happy path
2. `getProjectRepositoryBinding` happy path
3. `provisionProjectWorkspace` 会调用 provider + workspace provisioner + project repository
4. `syncProjectWorkspace` 会调用 provider + git fetch flow

## 7. 绿灯实现顺序

### 7.1 Step 1

先定义 provider port 和只读查询能力：

1. `getInstallUrl`
2. `listInstallations`
3. `listRepositories`
4. `createInstallationAccessToken`

### 7.2 Step 2

再补 project binding 持久化能力：

1. in-memory repository
2. Prisma repository
3. project route schema 扩展

### 7.3 Step 3

再补 workspace provision / sync 编排：

1. workspace path resolver
2. git clone / fetch command adapter
3. project workspace 写回

### 7.4 Step 4

最后补 composition root 接线和集成测试。

## 8. 测试文件组织建议

建议按以下位置落测试：

```text
apps/service/src/modules/integration/github/
  application/
    github-installation-queries.test.ts
    provision-project-workspace.test.ts
    sync-project-workspace.test.ts
  routes/
    github-integration.routes.test.ts
  infrastructure/
    prisma-github-installation-repository.test.ts

apps/service/src/modules/project/
  routes/
    project.routes.test.ts
    project.routes.integration.test.ts
  application/
    create-project.test.ts
```

如果实现过程中发现“project route 测试改动太大”，也允许把 repository binding 的 route tests 单独拆成：

```text
apps/service/src/modules/project/routes/project-repository-binding.routes.test.ts
```

## 9. 验收标准

本轮完成的标准不是“把所有设计文档都翻译成代码”，而是：

1. 文档中的 Phase 1 主线具备最小可运行实现
2. 所有新增行为都有红灯先行测试
3. 目标测试集稳定通过
4. 没有破坏现有 `rootPath` project 流程
5. `git` module 仍然保持 path-based 边界

## 10. 一句话总结

```text
这轮开发要先把“GitHub App repo access 是 project 外层编排能力，不是 auth 扩展，也不是 git 模块内逻辑”写成测试，
再让 schema、route、provider adapter 和 workspace flow 逐层满足这些测试。
```
