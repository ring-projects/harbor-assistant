# Project Context Design

## 1. 文档信息

- 文档名称：Project Context Design
- 日期：2026-03-24
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/project`
  - future project query / application services
  - `apps/web` 中 project detail / project settings / project shell 的后端契约
- 关联文档：
  - [backend-lite-ddd-design-2026-03-24.md](./backend-lite-ddd-design-2026-03-24.md)
  - [task-runtime-system-design-2026-03-23.md](./task-runtime-system-design-2026-03-23.md)
  - [service-database-schema-design-2026-03-25.md](./service-database-schema-design-2026-03-25.md)
  - [frd-frontend.md](./frd-frontend.md)
  - [project-api.md](./project-api.md)

## 2. 文档目标

这份文档只解决 `project` 上下文，不试图重新定义整个后端。

它要回答的问题只有五个：

1. `Project` 这个聚合到底拥有什么
2. `ProjectSettings` 应该如何被 `Project` 拥有
3. 哪些“项目相关”的东西不能继续塞进 `ProjectSettings`
4. `project` context 应该向外暴露哪些 command / query
5. 从 MVP 走向稳健设计时，`project` 模块应先收敛哪些边界

这里默认一个前提：

当前实现只能作为现状样本，不作为目标设计依据。目标设计以主文档中的 bounded context 和 aggregate 原则为准。

## 3. 设计前提

根据主文档，本设计采用以下判断作为前提：

1. `project` 是业务上下文，不是技术资源袋子
2. `Project` 是 `project` context 的唯一业务入口
3. `ProjectSettings` 属于 `project`，不属于单独配置上下文
4. 运行策略决议更适合作为应用层能力，而不是单独业务域
5. `filesystem` 和 `git` 是 supporting contexts，不回流到 `project` 聚合内部
6. `task` 和 `runtime` 读取项目配置，但不能绕过 `project` 自行定义项目真相

一句话收敛：

```text
Project owns project identity, lifecycle, and project-level policy defaults.
Runtime-policy resolves policies; it does not own project business state.
```

## 4. `project` context 的职责边界

### 4.1 它负责什么

`project` context 负责以下业务真相：

1. 项目身份
2. 项目根目录语义
3. 项目生命周期状态
4. 项目级默认策略
5. 项目级共享资源入口
6. 项目对外可见的主视图入口

其中“项目级共享资源入口”指的是：

1. project-local skill bridge 是否启用
2. project memory 是否需要初始化
3. future project-scoped integration registry

这些东西都与“某个项目”绑定，但不等于都应直接并入 `ProjectSettings`。

### 4.2 它不负责什么

`project` context 不负责：

1. task orchestration
2. runtime session lifecycle
3. raw runtime event source of truth
4. provider capability probing
5. filesystem root enforcement 细节
6. git repo 状态与 diff 细节
7. task request override 与最终 runtime config 决议

这几个边界必须清楚，否则 `ProjectSettings` 很快会重新膨胀成“所有和项目有关的配置大表”。

## 5. 聚合设计

### 5.1 Aggregate Root

`Project` 是 `project` context 的 aggregate root。

第一版建议的领域模型：

```ts
Project {
  id: string
  slug: string
  name: string
  description: string | null
  rootPath: string
  normalizedPath: string
  status: "active" | "archived" | "missing"
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  lastOpenedAt: string | null
  settings: ProjectSettings
}
```

这里最重要的点不是字段多少，而是：

1. `settings` 在领域层默认视为 `Project` 的一部分
2. command side 不应再把 `ProjectSettings` 当成独立业务入口
3. `Project` 的写入边界要覆盖 `settings`

### 5.2 Owned Record

`ProjectSettings` 是 `Project` 的 owned record，而不是另一个平级 aggregate root。

推荐领域表达：

```ts
ProjectSettings {
  execution: {
    defaultExecutor: string | null
    defaultModel: string | null
    defaultExecutionMode: string | null
    maxConcurrentTasks: number
  }
  retention: {
    logRetentionDays: number | null
    eventRetentionDays: number | null
  }
  skills: {
    harborSkillsEnabled: boolean
    harborSkillProfile: string | null
  }
  updatedAt: string
  version: number
}
```

说明：

1. 领域模型推荐按策略分组，而不是长期扁平摊开
2. 持久化层是否保留平铺字段，是实现细节，不影响领域判断
3. 增加 `version` 是为了稳健设计预留 optimistic concurrency 与审计基础

### 5.3 为什么 `ProjectSettings` 不是独立聚合

原因很简单：

1. settings 没有脱离 `Project` 独立存在的业务意义
2. settings 的 identity 实际上依赖 `Project`
3. settings 更新需要服从 project-level invariant
4. 创建项目时默认 settings 应与项目创建处于同一事务边界

因此，目标设计中可以有独立的数据表，但不应有独立的业务入口。

## 6. `Project` 的核心不变量

`Project` 至少应维护这些稳定不变量：

1. `normalizedPath` 在系统内唯一
2. `slug` 在系统内唯一，且应稳定可引用
3. `Project` 创建成功时必须具备可用的默认 `ProjectSettings`
4. `archived` 项目不能作为默认活跃工作区参与正常 task 创建
5. `missing` 项目不能被当成健康工作目录继续派发 runtime 工作
6. `maxConcurrentTasks` 必须为正整数
7. retention 字段若非空，必须为正整数
8. `defaultModel` 可以为空，但如果存在，其语义必须受 `defaultExecutor` 约束

最后一点的意思不是强制建立重型 provider schema，而是要求：

项目默认模型不能脱离执行器语义孤立存在。

## 7. `ProjectSettings` 的边界

### 7.1 它应该包含什么

`ProjectSettings` 只应保留“项目级默认策略”：

1. 默认执行器
2. 默认模型
3. 默认执行模式
4. 并发上限
5. 日志保留策略
6. 事件保留策略
7. 与 task/runtime 基线相关的 skill policy

这些设置的共同特点是：

1. 它们是 project-level baseline
2. 它们被 runtime-policy resolver 读取后参与决议
3. 它们不表达一次具体任务的瞬时状态

### 7.2 它不应该包含什么

下面这些内容不要继续塞进 `ProjectSettings`：

1. runtime session 当前状态
2. provider capability probe 结果
3. UI-only 偏好
4. task 创建表单草稿
5. git 状态缓存
6. filesystem 浏览偏好
7. MCP server registry 的完整生命周期数据
8. integration secret / token / credential

尤其要避免两种常见退化：

1. 把 `ProjectSettings` 做成“项目级 JSON 大杂烩”
2. 让每个 supporting context 都往 settings 上追加字段

### 7.3 future integration data 放在哪里

如果后续出现 project-scoped integrations，例如：

1. MCP server registrations
2. future notification channels
3. future repo-specific automation rules

推荐做法是：

1. 它们仍属于 `project` context
2. 但它们应作为独立 entity / aggregate 设计
3. 不应因为“都和项目有关”就直接并入 `ProjectSettings`

判断标准只有一个：

如果一个对象有自己的生命周期、唯一性约束、启停状态或审计需求，它就不再只是 settings 字段。

## 8. Application Layer 设计

### 8.1 Commands

第一版建议使用意图明确的 commands，而不是一个无限膨胀的通用 patch。

推荐命令：

1. `CreateProject`
2. `RenameProject`
3. `RelocateProjectRoot`
4. `UpdateProjectDescription`
5. `ArchiveProject`
6. `RestoreProject`
7. `MarkProjectMissing`
8. `UpdateProjectSettings`

如果后续 settings 继续增长，再拆为：

1. `UpdateProjectExecutionPolicy`
2. `UpdateProjectRetentionPolicy`
3. `UpdateProjectSkillPolicy`

但在第一版里，仍然可以保留一个 `UpdateProjectSettings` 作为应用层入口，只要它遵守清晰的分组语义。

### 8.2 Queries

推荐查询：

1. `ListProjects`
2. `GetProjectDetail`
3. `GetProjectSettings`
4. `GetProjectOverview`

其中：

1. `GetProjectDetail` 面向项目详情页
2. `GetProjectSettings` 面向设置页
3. `GetProjectOverview` 可以是给 project shell 的组合读模型

### 8.3 Command / Query 分离原则

必须明确：

1. command side 维护 `Project` 聚合真相
2. query side 可以组合 git / filesystem / capability 信息
3. query side 返回给前端的“项目概览”可以比领域模型更宽
4. 但 query side 不能反向决定 `Project` 的业务状态

## 9. Repository 边界

目标设计中，command side 应只有一个聚合持久化边界：

1. `ProjectRepository`

它负责：

1. 读取 `Project` 聚合
2. 保存 `Project` 聚合
3. 保证 `Project` 与 `ProjectSettings` 的事务一致性

这意味着：

1. 不应再把 `ProjectSettings` 的写路径当成独立 repository 边界
2. settings 的单独表存在与否，不改变 aggregate persistence boundary
3. “更新项目设置”本质上仍是“保存 `Project` 聚合”

如果为了查询性能需要，可额外存在：

1. `ProjectQueryRepository`
2. `ProjectSettingsReadRepository`

但它们属于 read side，不代表领域入口。

## 10. 对外 API 设计

对前端暴露时，`project` context 应继续拥有这些 API：

1. `GET /projects`
2. `POST /projects`
3. `GET /projects/:id`
4. `PATCH /projects/:id`
5. `GET /projects/:id/settings`
6. `PATCH /projects/:id/settings`

补充约束：

1. `/projects/:id/settings` 仍然属于 `project` context
2. 它不意味着存在独立 `ProjectSettings` 聚合
3. `filesystem` 与 `git` 能力不要重新缝进 `/projects/:id/settings`

如果后续需要 project shell 首页聚合视图，优先新增：

1. `GET /projects/:id/overview`

而不是让 `GET /projects/:id` 持续膨胀成杂糅接口。

## 11. 前端 Project Settings 页的设计约束

如果要把设置页从 MVP 升级为稳健设计，建议按领域语义组织，而不是按数据库字段组织。

推荐分区：

1. `General`
   - 项目名称
   - 描述
   - root path 只读或受控变更入口
   - lifecycle status
2. `Execution Policy`
   - default executor
   - default model
   - default execution mode
   - max concurrent tasks
3. `Retention Policy`
   - log retention
   - event retention
4. `Skills / Project Resources`
   - harbor skills enablement
   - profile
   - future project-scoped resource toggles

页面上还应遵守两条规则：

1. UI 展示 capability status，但 capability 不写回 `ProjectSettings`
2. UI 可以展示 resolved summary，但 resolved summary 不等于 persisted settings

## 12. 与 `runtime-policy` capability 的协作

这里不建议把“策略决议”建成独立 bounded context。

更合适的做法是保留一个应用层 `RuntimePolicyResolver`，负责读取并决议，而不是拥有 `ProjectSettings`。

推荐链路：

```text
System defaults
  + Project.settings
  + Task request overrides
  -> ResolvedRuntimeConfig
  -> runtime.startOrResumeSession(...)
```

这里要避免两个错误方向：

1. 把 `ResolvedRuntimeConfig` 持久化回 `ProjectSettings`
2. 让 runtime-policy resolver 反向修改 `Project` 的业务字段

`ProjectSettings` 是 baseline，`ResolvedRuntimeConfig` 是 runtime-time result，这两个对象不能混成一个。

## 13. 与 supporting contexts 的协作

### 13.1 `filesystem`

`Project` 只拥有“项目根目录语义”。

它不拥有：

1. 目录遍历
2. 文件读写规则
3. root boundary enforcement 实现细节

### 13.2 `git`

`Project` 可以引用“这是一个 repo-scoped project”的业务事实，但不拥有：

1. branch / diff / status query
2. watcher 实现
3. commit history 语义

### 13.3 `interaction`

实时订阅时，可以订阅：

1. `project:{projectId}`

但 topic owner 仍然是 `project` context，而不是 websocket gateway 本身。

## 14. 推荐模块结构

目标结构建议收敛成：

```text
modules/project/
├── domain/
│   ├── project.ts
│   ├── project-settings.ts
│   └── project.errors.ts
├── application/
│   ├── commands/
│   ├── queries/
│   └── project.application-service.ts
├── repositories/
│   ├── project.repository.ts
│   └── project-query.repository.ts
├── routes/
├── schemas/
└── index.ts
```

关键不是目录，而是依赖方向：

1. route -> application service
2. application service -> repository + supporting ports
3. repository -> Prisma / DB
4. query service 可以组装 supporting context 的读能力

## 15. 演进顺序

从 MVP 走向稳健设计，建议按下面顺序推进：

### Phase 1

先把 `Project` 聚合边界写清楚：

1. 明确 `Project` owns `ProjectSettings`
2. 明确 command side 只有 `ProjectRepository`
3. 明确 settings 是 owned record，不是独立业务入口

### Phase 2

收敛 API 语义：

1. `/projects/:id` 负责项目身份与生命周期
2. `/projects/:id/settings` 负责项目默认策略
3. project shell 需要的聚合信息走独立 overview query

### Phase 3

把 project-scoped integrations 从 settings 中分离：

1. MCP server registry
2. future notifications
3. future automation / hooks

### Phase 4

再补稳健性能力：

1. optimistic concurrency
2. audit trail
3. missing project recovery flow
4. background reconciliation

## 16. 最终结论

如果只保留一句话，应该是：

```text
Project is the business root of the project context.
ProjectSettings is an owned policy record of Project, not an independent business root.
```

进一步展开就是：

1. `Project` 拥有项目身份、路径语义、生命周期和项目级默认策略
2. `ProjectSettings` 只承载 baseline policy，不承载一切 project-scoped data
3. runtime-policy resolver 读取 `ProjectSettings` 做决议，但不拥有它
4. `project` 的写边界必须以 `Project` 聚合为中心
5. 任何未来新增的 project-scoped integration，都应先判断它是不是“真正的 settings”

只要后续设计还能守住这五点，`project` 上下文就不会再次退化回 MVP 阶段的松散 CRUD 模式。
