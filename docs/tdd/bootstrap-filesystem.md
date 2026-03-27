# Bootstrap Filesystem TDD Plan

## 1. 文档信息

- 文档名称：Bootstrap Filesystem TDD Plan
- 日期：2026-03-26
- 状态：Proposed
- 适用范围：
  - `apps/service/src/modules/filesystem`
  - `apps/service/src/routes/v1`
  - `apps/web/src/components/directory-picker`
- 关联文档：
  - [../bootstrap-filesystem-api-design-2026-03-26.md](../bootstrap-filesystem-api-design-2026-03-26.md)
  - [../filesystem-context-design-2026-03-24.md](../filesystem-context-design-2026-03-24.md)
  - [./filesystem.md](./filesystem.md)

## 2. 目标

这份文档不是泛泛地说“用 TDD 做开发”，而是把 bootstrap filesystem API 的开发拆成可以逐轮执行的红灯 / 绿灯 / 重构步骤。

目标只有四个：

1. 先固定 bootstrap allowed roots 语义
2. 再固定 root-scoped browse / stat contract
3. 最后再把 Fastify route、schema 和 v1 注册接起来
4. 在后端 contract 稳定后，再迁移前端目录选择器

## 3. 范围控制

首轮 TDD 范围只包括：

1. `GET /v1/bootstrap/filesystem/roots`
2. `POST /v1/bootstrap/filesystem/list`
3. `GET /v1/bootstrap/filesystem/stat`

不包括：

1. create directory
2. read file
3. write file
4. inspect-project-root
5. 自动创建项目

## 4. 总体顺序

必须按下面顺序推进：

1. config / root registry tests
2. application use-case tests
3. route tests
4. v1 registration tests
5. web client migration tests

不建议跳过前 2 层直接开始写 Fastify route。

原因很简单：

bootstrap filesystem 的复杂度不在 HTTP，而在：

1. root registry 合法性
2. root-scoped path resolution
3. outside-root reject
4. relative path response contract

## 5. 开发前准备

开始写测试前，先确认现有可复用资产：

1. 现有 root-scoped filesystem use cases：
   - [`list-directory.ts`](../../apps/service/src/modules/filesystem/application/list-directory.ts)
   - [`stat-path.ts`](../../apps/service/src/modules/filesystem/application/stat-path.ts)
2. 现有错误映射：
   - [`filesystem-app-error.ts`](../../apps/service/src/modules/filesystem/filesystem-app-error.ts)
3. 现有 route schema：
   - [`filesystem.schema.ts`](../../apps/service/src/modules/filesystem/schemas/filesystem.schema.ts)
4. 现有目录选择器：
   - [`directory-picker.tsx`](../../apps/web/src/components/directory-picker/directory-picker.tsx)

测试命令建议：

```bash
pnpm --dir apps/service test
```

单文件迭代建议：

```bash
pnpm --dir apps/service test -- src/modules/filesystem/routes/bootstrap-filesystem.routes.test.ts
pnpm --dir apps/service test -- src/modules/filesystem/application/list-bootstrap-directory.test.ts
pnpm --dir apps/service test -- src/modules/filesystem/application/stat-bootstrap-path.test.ts
```

## 6. 目标文件布局

建议新增文件：

```text
apps/service/src/modules/filesystem/
  application/
    bootstrap-root-registry.ts
    bootstrap-root-registry.test.ts
    list-bootstrap-directory.ts
    list-bootstrap-directory.test.ts
    stat-bootstrap-path.ts
    stat-bootstrap-path.test.ts
  routes/
    bootstrap-filesystem.routes.test.ts
  schemas/
    filesystem.schema.ts
```

可能需要调整的文件：

```text
apps/service/src/modules/filesystem/errors.ts
apps/service/src/modules/filesystem/filesystem-app-error.ts
apps/service/src/modules/filesystem/routes/index.ts
apps/service/src/modules/filesystem/index.ts
apps/service/src/routes/v1/index.ts
apps/service/src/config/*
```

前端迁移阶段可能涉及：

```text
apps/web/src/components/directory-picker/hooks/use-directory-entries-query.ts
apps/web/src/components/directory-picker/types.ts
apps/web/src/modules/projects/components/create-project.tsx
```

## 7. 红绿灯分阶段步骤

### 7.1 第一轮：bootstrap root registry

#### 红灯

先写 `bootstrap-root-registry.test.ts`，只表达 root registry 的规则：

1. 可以从配置中读取 roots
2. root `id` 必须唯一
3. root `path` 必须 canonicalize 成绝对路径
4. 只能有一个 default root
5. 空 roots 配置时，registry 返回 disabled 状态或抛出明确错误
6. `getRootById("missing")` 返回结构化错误

建议测试名：

1. `loads configured bootstrap filesystem roots`
2. `rejects duplicate root ids`
3. `rejects multiple default roots`
4. `normalizes root paths before exposure`
5. `raises bootstrap-filesystem-disabled when no roots are configured`
6. `raises filesystem-root-not-found for unknown root ids`

#### 绿灯

补最小实现：

1. 新增 `bootstrap-root-registry.ts`
2. 实现 `createBootstrapRootRegistry(configRoots)`
3. 暴露：
   - `listRoots()`
   - `getRoot(rootId)`

#### 重构

只做最小整理：

1. 统一 root normalization 命名
2. 把错误构造器收敛到 `errors.ts`

通过标准：

1. registry 层测试全部通过
2. 还没有引入 Fastify 或 route schema

### 7.2 第二轮：list bootstrap directory use case

#### 红灯

新增 `list-bootstrap-directory.test.ts`，只表达 application 语义：

1. 当 `rootId` 存在且 `path` 为空时，返回 root 顶层目录列表
2. 当 `path` 为相对路径时，返回对应子目录列表
3. `directoriesOnly: true` 时过滤文件
4. `directoriesOnly: false` 时保留完整 entries
5. 当 `path` 指向文件时，返回 `NOT_A_DIRECTORY`
6. 当 `path` 不存在时，返回 `PATH_NOT_FOUND`
7. 当 `path` 试图越界时，返回 `PATH_OUTSIDE_ALLOWED_ROOT`
8. 当 `rootId` 不存在时，返回 `FILESYSTEM_ROOT_NOT_FOUND`

建议测试数据：

1. 一个 root 目录
2. root 下一个子目录 `apps`
3. root 下一个普通文件 `README.md`

建议测试命令：

```bash
pnpm --dir apps/service test -- src/modules/filesystem/application/list-bootstrap-directory.test.ts
```

#### 绿灯

补最小实现：

1. 新增 `list-bootstrap-directory.ts`
2. 依赖 `bootstrap-root-registry`
3. 内部转调已有 `listDirectoryUseCase(repository, { rootPath, path, ... })`
4. 在返回值层补齐：
   - `rootId`
   - `rootPath`
   - `absolutePath`
   - root-relative `path`
   - root-relative `parentPath`
5. `directoriesOnly` 在 bootstrap use case 层处理，不污染底层通用 `listDirectoryUseCase`

#### 重构

把 relative path 转换逻辑抽到一个 helper，例如：

1. `toBootstrapRelativePath(rootPath, absolutePath)`
2. `toBootstrapListing(...)`

通过标准：

1. application tests 全绿
2. 仍未接入 HTTP
3. 仍未修改前端

### 7.3 第三轮：stat bootstrap path use case

#### 红灯

新增 `stat-bootstrap-path.test.ts`，覆盖：

1. root 本身可被 stat
2. 子目录可被 stat
3. 普通文件可被 stat
4. 缺失路径返回 `PATH_NOT_FOUND`
5. 越界路径返回 `PATH_OUTSIDE_ALLOWED_ROOT`
6. 缺失 rootId 返回 `FILESYSTEM_ROOT_NOT_FOUND`

#### 绿灯

补最小实现：

1. 新增 `stat-bootstrap-path.ts`
2. 依赖 `bootstrap-root-registry`
3. 内部转调已有 `statPathUseCase(repository, { rootPath, path })`
4. 输出：
   - `rootId`
   - `rootPath`
   - `path`
   - `absolutePath`
   - filesystem stat fields

#### 重构

把 list / stat 共用的 mapping 收敛成统一 helper，避免重复生成：

1. `rootId`
2. `rootPath`
3. `path`
4. `absolutePath`

### 7.4 第四轮：错误模型与 app error mapping

#### 红灯

先补错误测试，覆盖：

1. `BOOTSTRAP_FILESYSTEM_DISABLED` -> `503`
2. `FILESYSTEM_ROOT_NOT_FOUND` -> `404`
3. `FILESYSTEM_ROOT_NOT_ALLOWED` -> `403`

这里可以新增一个 focused test 文件，也可以在 route tests 中先写失败断言。

#### 绿灯

修改：

1. `apps/service/src/modules/filesystem/errors.ts`
2. `apps/service/src/modules/filesystem/filesystem-app-error.ts`

要求：

1. 不破坏现有 project-scoped filesystem error mapping
2. bootstrap 错误与原有 filesystem 错误共存

#### 重构

如果错误码数量明显增加，整理错误构造器命名，避免 bootstrap 和 project-scoped 含义混淆。

### 7.5 第五轮：schema tests / route tests

#### 红灯

新增 `bootstrap-filesystem.routes.test.ts`，优先覆盖 route contract，而不是实现细节：

1. `GET /bootstrap/filesystem/roots` 返回 `200` 和 roots 列表
2. `POST /bootstrap/filesystem/list` 返回 `200` 和 listing
3. `GET /bootstrap/filesystem/stat` 返回 `200` 和 pathInfo
4. list body 缺少 `rootId` 返回 `400`
5. stat query 缺少 `rootId` 返回 `400`
6. unknown root 返回 `404`
7. outside-root path 返回 `403`

建议仿照现有：

1. [`project-filesystem.routes.test.ts`](../../apps/service/src/modules/filesystem/routes/project-filesystem.routes.test.ts)
2. [`project.routes.test.ts`](../../apps/service/src/modules/project/routes/project.routes.test.ts)

#### 绿灯

修改：

1. `apps/service/src/modules/filesystem/schemas/filesystem.schema.ts`
2. `apps/service/src/modules/filesystem/routes/index.ts`

要求：

1. route 只做 schema + adapter
2. route 不直接操纵路径字符串
3. route 不直接读取 config

#### 重构

如果 `routes/index.ts` 变得过长，可以把 bootstrap route 注册拆成局部私有函数，但暂时不要为了“整洁”重构出一个全新模块。

### 7.6 第六轮：v1 route registration

#### 红灯

补一轮集成测试或 smoke test，覆盖：

1. `registerV1Routes` 后 bootstrap route 可用
2. bootstrap roots 配置被正确注入 filesystem route registration

如果当前没有现成测试承载点，可以通过 route test 中手动组装 instance 的方式先覆盖，不强求独立文件。

#### 绿灯

修改：

1. `apps/service/src/routes/v1/index.ts`
2. service config 解析层

要求：

1. bootstrap roots 通过 config 注入
2. 不要在 route 层直接读取 `process.env`

#### 重构

统一 config naming，避免同时出现：

1. `bootstrapRoots`
2. `filesystemRoots`
3. `allowedRoots`

首版建议定名：

1. `bootstrapFileSystemRoots`

### 7.7 第七轮：前端目录选择器迁移

这一轮放在后端 contract 稳定后。

#### 红灯

先写前端数据层测试，覆盖：

1. 首次加载先请求 roots
2. 选中 default root 后请求 list
3. 确认前调用 stat
4. 错误文案能展示 root-not-found / permission-denied / path-not-found

#### 绿灯

修改：

1. `use-directory-entries-query.ts`
2. 可能新增 `use-bootstrap-filesystem-roots-query.ts`
3. 可能新增 `use-bootstrap-path-stat-query.ts`
4. `CreateProject` 接入 picker

要求：

1. 最终提交 `POST /v1/projects` 时仍然使用 `absolutePath`
2. 前端不再调用不存在的 `/v1/fs/list`

#### 重构

如果目录选择器 props 已经不适合新 contract，再重构组件状态，但不要在这轮顺手改 landing page 视觉结构。

## 8. 每轮提交前检查项

每一轮完成后都检查：

1. 新增测试是否先于实现出现
2. 是否只让当前失败用例变绿，而没有提前扩 scope
3. 是否仍然坚持 `rootId + relativePath` contract
4. 是否避免重新引入任意绝对路径浏览 API
5. 是否没有把 bootstrap 逻辑塞进 `project` module

## 9. 建议的开发顺序与命令

### 9.1 后端第一阶段

```bash
pnpm --dir apps/service test -- src/modules/filesystem/application/bootstrap-root-registry.test.ts
pnpm --dir apps/service test -- src/modules/filesystem/application/list-bootstrap-directory.test.ts
pnpm --dir apps/service test -- src/modules/filesystem/application/stat-bootstrap-path.test.ts
```

### 9.2 后端第二阶段

```bash
pnpm --dir apps/service test -- src/modules/filesystem/routes/bootstrap-filesystem.routes.test.ts
pnpm --dir apps/service typecheck
```

### 9.3 前端迁移阶段

```bash
pnpm --dir apps/web test
pnpm --dir apps/web typecheck
```

## 10. 完成定义

当且仅当下面条件都成立时，这个 TDD 计划算执行完成：

1. backend tests 已覆盖 roots / list / stat 的正反路径
2. bootstrap API 已可从 `registerV1Routes` 暴露
3. 前端目录选择器不再依赖 `/v1/fs/list`
4. `CreateProject` 可以通过选择目录完成项目创建
5. 整个流程没有重新打开“任意绝对路径全局遍历”能力
