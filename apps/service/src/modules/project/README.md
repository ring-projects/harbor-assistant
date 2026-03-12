# Project Module

`project` 模块当前已经按 Fastify + Prisma 的组合方式做过一次收敛，职责边界如下：

```text
modules/project/
├── errors.ts
├── index.ts
├── repositories/
│   ├── project.repository.ts
│   └── project-settings.repository.ts
├── routes/
│   ├── index.ts
│   └── project.routes.ts
├── schemas/
│   ├── index.ts
│   └── project.schema.ts
├── services/
│   ├── index.ts
│   ├── project.service.ts
│   ├── project-settings.service.ts
│   └── project-skill-bridge.service.ts
└── types.ts
```

## 1. 设计目标

这个模块现在遵循以下约束：

- Route 只负责注册接口、声明 `schema`、调用 service。
- Service 负责业务编排和错误收口。
- Repository 只负责 Prisma 读写和底层数据转换。
- 模块错误统一走 `ProjectError` + `createProjectError.*`。
- Fastify request validation 使用原生 JSON Schema，而不是在 route 里手写解析逻辑。

## 2. 当前职责划分

### `errors.ts`

- 定义 `ProjectError`
- 定义 `createProjectError.*` 工厂函数
- 所有 project 相关错误都应从这里创建

### `repositories/`

- `project.repository.ts`
  - 项目主表 CRUD
  - 路径 canonicalize
  - Prisma model 到 domain type 的映射
- `project-settings.repository.ts`
  - 项目设置读写

Repository 层不处理 HTTP，不拼响应。

### `services/`

- `project.service.ts`
  - 项目查询、创建、更新、删除
- `project-settings.service.ts`
  - 项目设置业务逻辑
- `project-skill-bridge.service.ts`
  - 管理 Harbor project-local skill bridge
  - 负责 `.codex/skills/harbor-*` symlink、自愈和 `.git/info/exclude`

Service 层只抛结构化错误，不自己返回 HTTP 错误响应。

### `routes/`

- `project.routes.ts`
  - `/projects`
  - `/projects/:id`
- `routes/index.ts`
  - 模块 composition root
  - 用 `app.prisma` 构造 repository / service，并把 service 注入 route

### `schemas/`

- route body / params / response schema 全部拆到这里
- 当前采用 Fastify 原生 JSON Schema
- Route 文件不再堆大量 schema 常量

## 3. 对 Fastify 的贴合度

当前 `project` 模块已经比较接近 Fastify 官方推荐的实现方式：

- 路由声明中使用 `schema`
- request validation 交给 Fastify / Ajv
- error response 交给全局 error handler
- 不在 route 里手写局部错误映射
- 通过模块 composition root 注入依赖，而不是散落创建实例

这比此前的“模块入口里混合导出函数、route 里直接解析输入、局部处理错误”的方式更清晰。

## 4. 当前公开入口

文件：[index.ts](/Users/qiuhao/workspace/harbor-assistant/apps/service/src/modules/project/index.ts)

当前保留的公开能力只有几类：

- domain types
- `ProjectError` / `createProjectError`
- repository / service factory
- `registerProjectModuleRoutes`
- `createProjectModule({ prisma, harborHomeDirectory })`

已经删除的遗留形态：

- `listProjects()`
- `getProjectById()`
- `createProject()`
- 这类基于默认单例的 wrapper export

保留 factory API 的原因是：

- 避免模块偷偷持有全局状态
- 依赖关系更清楚
- 在 route、task service、测试里都能显式注入 `prisma`

## 5. 仍然需要注意的点

- JSON Schema 已经拆分，但还可以继续补更细的字段约束，例如更明确的长度或格式限制。
- Harbor skill bridge 目前先覆盖 project 设置和 task runtime，后续如果需要状态可观测性，可以再补桥接状态查询接口。
- 目前的测试已经覆盖核心 route / service 路径，但还可以继续补更多异常分支和并发场景。

## 6. 后续演进建议

如果继续打磨这个模块，优先级建议如下：

1. 为 `project` 路由补 Fastify 注入测试，覆盖 200 / 400 / 404 / 409。
2. 决定是否为 `project-settings` 增补完整读写接口。
3. 继续把其他模块按同样模式收紧边界和测试覆盖。
