# Filesystem Context Design

## 1. 文档信息

- 文档名称：Filesystem Context Design
- 日期：2026-03-24
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/filesystem`
  - future project-scoped file facade
  - future file read / write / stat / list application services
- 关联文档：
  - [backend-lite-ddd-design-2026-03-24.md](./backend-lite-ddd-design-2026-03-24.md)
  - [project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
  - [git-project-boundary-design-2026-03-24.md](./git-project-boundary-design-2026-03-24.md)
  - [service-error-handling-guide.md](./service-error-handling-guide.md)

## 2. 文档目标

这份文档只解决 `filesystem` supporting context，不试图重新定义整个后端。

它要回答的问题只有五个：

1. `filesystem` 到底负责什么
2. `filesystem` 和 `project` 之间怎样分边界
3. root boundary enforcement 应该由谁负责
4. 新的 `filesystem` module 应该向外暴露哪些 command / query
5. 从 MVP 走向稳健设计时，应先收敛哪些能力，哪些先不要做

这里默认一个前提：

当前实现只能作为现状样本，不作为目标设计依据。目标设计以主文档中的 bounded context 和 dependency direction 为准。

## 3. 设计前提

根据主文档，本设计采用以下判断作为前提：

1. `filesystem` 是 supporting context，不是业务主上下文
2. `filesystem` 不拥有 `Project` 身份与生命周期
3. `filesystem` 自己拥有 path canonicalization 与 root boundary enforcement
4. `filesystem` 不理解 git repository 语义
5. `project` 可以提供 root path，但不能替代 `filesystem` 做文件系统安全判断
6. `git` 可以读取路径，但不能替代 `filesystem` 定义路径访问策略

一句话收敛：

```text
Project owns project identity and root-path meaning.
Filesystem owns path resolution, traversal safety, and file access semantics inside a root boundary.
```

## 4. 当前问题

当前旧实现的优点很明确：

1. 已经把 rootDirectory 作为能力输入，而不是写死在 route 里
2. 已经体现出 canonical path 与 path outside root 的判断
3. 已经把 directory list 做成了独立 service

但它还不适合作为新模块的目标设计，主要问题有四个：

### 4.1 能力面过窄

当前几乎只有 `listDirectory`，还不足以支撑“文件模块”的稳定边界。

至少还缺：

1. `statPath`
2. `readTextFile`
3. future `writeTextFile`
4. future `createDirectory`

### 4.2 root policy 还更像 route 级配置，不像清晰的模块输入边界

旧实现里 `rootDirectory` 是 module 初始化参数，这比把它塞进 route 好，但还没有清楚表达：

1. root boundary 是 `filesystem` 的核心职责
2. root path 来源可以是 system config，也可以是 project root
3. 外层只负责提供 root，不负责做越界判断

### 4.3 `filesystem` 和 `project` 的 facade 关系还没有文档化

如果未来有 `/projects/:id/files/...` 这种接口，正确做法应该是：

```text
project-scoped facade
  -> project: resolve projectId -> rootPath
  -> filesystem: operate inside root boundary
```

而不是：

```text
filesystem -> projectRepository
```

### 4.4 错误模型还偏 list-directory 导向

旧错误模型已经有基础，但未来若增加 read / write / stat，需要更明确地区分：

1. invalid path
2. path not found
3. not a directory
4. not a file
5. outside allowed root
6. permission denied
7. read failed
8. write failed

## 5. `filesystem` context 的职责边界

### 5.1 它负责什么

`filesystem` context 负责以下技术真相：

1. path canonicalization
2. requested path resolution
3. root boundary enforcement
4. directory listing
5. file stat / file read / future file write
6. symlink / hidden file / missing path policy
7. text / binary 文件的基础识别策略

这里的关键点不是“它能读写磁盘”，而是：

它对外提供的是“在指定 root boundary 内安全访问文件系统”的稳定能力。

### 5.2 它不负责什么

`filesystem` context 不负责：

1. `Project` 生命周期
2. `Task` 生命周期
3. git repo root / branch / diff 语义
4. runtime session lifecycle
5. UI-only 文件树偏好
6. editor buffer / draft 状态

尤其要避免两种退化：

1. 把 `filesystem` 做成 `project` 的内部附属类库
2. 把 `filesystem` 做成“顺手帮你判断 git / project / task 的超级工具箱”

## 6. 输入边界设计

### 6.1 `filesystem` 不接受 `projectId`

新的 `filesystem` module 本体不应该接收：

1. `projectId`
2. `ProjectRepository`
3. `ProjectQuery`

它真正需要的输入应该是：

1. `rootPath`
2. `path`

推荐形式：

```ts
filesystem.listDirectory({
  rootPath,
  path,
  cursor,
  limit,
  includeHidden,
})

filesystem.statPath({
  rootPath,
  path,
})

filesystem.readTextFile({
  rootPath,
  path,
  maxBytes,
})
```

### 6.2 为什么 `rootPath` 必须成为显式输入

因为 `filesystem` 自己要负责边界安全，所以它不能只接受一个裸路径然后假设调用方已经做过判断。

这条规则很重要：

```text
Filesystem must receive the boundary it is expected to enforce.
```

也就是说：

1. `project` 可以提供 root path
2. `config` 可以提供 root path
3. 但越界判断必须留在 `filesystem`

### 6.3 路径形式建议

第一版建议统一：

1. 外部输入允许绝对路径或相对路径
2. 内部先基于 `rootPath` 做 resolve
3. 再做 canonicalization
4. 最后判断是否仍在 root 内

这样做的目的是：

1. 避免相对路径和绝对路径混杂带来的调用歧义
2. 把安全判断收敛在一处
3. 不让 facade / route 重复实现路径规则

## 7. `project` 和 `filesystem` 的边界

### 7.1 `project` 负责什么

`project` 负责：

1. `projectId` 是否存在
2. 项目 root path 的业务意义
3. 项目当前是否可被视为有效工作区

### 7.2 `filesystem` 负责什么

`filesystem` 负责：

1. 给定 root path 后如何访问文件系统
2. 请求路径是否越界
3. 请求路径是否存在
4. 请求路径到底是 file、directory、symlink 还是不可读对象

### 7.3 facade 应该怎么拆

如果未来保留 `/projects/:id/files/...`，推荐拆成：

```text
project-scoped file facade / route adapter
  -> project module: resolve projectId -> rootPath
  -> filesystem module: operate on { rootPath, path }
```

这意味着：

1. project-scoped 是 API scope
2. root-scoped 才是 `filesystem` module scope
3. 不要把 API scope 误当成 `filesystem` 本体的领域输入

## 8. 能力面设计

### 8.1 第一版 Queries

第一版建议先做：

1. `ListDirectory`
2. `StatPath`
3. `ReadTextFile`

原因：

1. 这三项都是 query
2. 风险比 write 类命令低
3. 它们足以支撑大部分文件浏览、预览、调试和基础编辑前置能力

### 8.2 第二版 Commands

第二版再考虑：

1. `WriteTextFile`
2. `CreateDirectory`
3. future `DeletePath`
4. future `RenamePath`

命令能力比 query 敏感得多，因为它们引入：

1. 覆盖策略
2. binary / text 边界
3. create parent 策略
4. 竞争写入与并发问题

### 8.3 当前非目标

第一轮不要急着做：

1. 文件搜索
2. watcher
3. project-scoped facade
4. bulk write / move / copy
5. git-aware file overlays
6. editor session state

## 9. 错误模型

新的 `filesystem` module 建议至少收敛这些结构化错误：

1. `INVALID_INPUT`
2. `PATH_NOT_FOUND`
3. `NOT_A_DIRECTORY`
4. `NOT_A_FILE`
5. `PATH_OUTSIDE_ALLOWED_ROOT`
6. `PERMISSION_DENIED`
7. `READ_FAILED`
8. `WRITE_FAILED`

关键原则：

1. facade 负责 `PROJECT_NOT_FOUND`
2. `filesystem` 负责文件系统语义错误
3. 不把系统 `errno` 直接泄漏成外部契约

## 10. 推荐目录结构

推荐结构：

```text
apps/service/src/modules/filesystem/
  domain/
    path-policy.ts
    file-entry.ts
  application/
    filesystem-repository.ts
    list-directory.ts
    stat-path.ts
    read-text-file.ts
    write-text-file.ts
  infrastructure/
    node-filesystem-repository.ts
  routes/
    index.ts
  schemas/
    index.ts
```

这里要注意：

1. `filesystem` 不需要硬套业务聚合
2. 但仍然应该有清晰的 application / infrastructure 边界
3. path policy 可以像 `git` 的 parser 一样，收敛成纯 helper / domain-like logic

## 11. 最终结论

新的 `filesystem` module 只有一个核心原则：

```text
Root first, path safety first, facade later.
```

展开就是：

1. 先把 `filesystem` 做成 root-scoped capability
2. 先验证 canonicalization 与 boundary enforcement，再扩展 command 面
3. 把 `projectId -> rootPath` 的逻辑永远留在 `filesystem` module 外层

只要守住这条顺序，新的 `filesystem` module 就不会退化成“项目查询 + 文件访问 + 其他上下文顺手判断”混杂在一起的实现。
