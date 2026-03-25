# Service Module Standard Based On Project

本文以 `apps/service/src/modules/project` 为样板，总结当前 `service` 侧一个模块应该长成什么样，并给出后续其他模块可复用的实现规范。

目标不是把 `project` 神化成“最终形态”，而是把它已经验证有效的部分固化下来，作为 `tasks`、`filesystem` 等模块后续收敛时的参考。

## 1. Project 模块当前现状

### 1.1 已完成的结构收敛

当前 `project` 模块目录如下：

```text
apps/service/src/modules/project/
├── __tests__/
├── errors.ts
├── index.ts
├── repositories/
├── routes/
├── schemas/
├── services/
└── types.ts
```

它已经具备下面这些明确的边界：

- `routes/`
  - 只注册路由
  - 只声明 Fastify `schema`
  - 只调用 service
- `services/`
  - 负责业务编排
  - 负责聚合 repository 和外部 gateway
  - 负责把空结果或非法状态转成结构化错误
- `repositories/`
  - 只负责 Prisma 读写
  - 只负责数据模型转换
  - 不承担 HTTP 语义
- `schemas/`
  - 拆分 route 级 JSON Schema
  - 避免 router 文件膨胀
- `errors.ts`
  - 模块内唯一错误定义入口
  - 采用 `ProjectError + createProjectError.*` 的 factory-only 结构
- `__tests__/`
  - 模块自己的测试与业务代码相邻
  - 便于按模块定位行为和回归

### 1.2 已对齐的 Fastify 实践

当前 `project` 模块已经较好地对齐了 Fastify 在服务端模块设计上的推荐方向：

- 请求校验尽量放在 route `schema` 中，而不是手写解析逻辑
- route 不做局部错误映射，统一交给全局 error handler
- 依赖通过 composition root 注入，而不是在每层偷偷 new
- 模块入口保留 factory，而不是导出一堆默认单例函数
- 路由测试优先验证 HTTP 行为，而不是只测函数调用次数

对应关键文件：

- 路由组合根：[apps/service/src/modules/project/routes/index.ts](../apps/service/src/modules/project/routes/index.ts)
- 模块工厂入口：[apps/service/src/modules/project/index.ts](../apps/service/src/modules/project/index.ts)
- 错误定义：[apps/service/src/modules/project/errors.ts](../apps/service/src/modules/project/errors.ts)
- 路由 schema：[apps/service/src/modules/project/schemas/project.schema.ts](../apps/service/src/modules/project/schemas/project.schema.ts)
- 测试样例：[apps/service/src/modules/project/__tests__/project.routes.test.ts](../apps/service/src/modules/project/__tests__/project.routes.test.ts)

### 1.3 当前值得保留的优点

`project` 目前最值得其他模块借鉴的是这些点：

1. 模块边界清楚
   route、service、repository、schema、error 的职责没有继续混在一起。

2. 错误模型清楚
   不再用散落的 `status map`、`message map`、`custom error class` 多层套娃，而是直接在错误工厂里定义 HTTP 语义。

3. 依赖关系可见
   `createProjectModule({ prisma })` 和 `registerProjectModuleRoutes(app)` 都是显式注入，不依赖隐藏单例。

4. 可测试性明显提升
   现在可以直接用 Fastify `inject` 跑真实 route 集成测试，而不是只能在 service 层做脆弱 mock。

5. 路由文件规模受控
   schema 被拆出去以后，router 文件只保留接口声明和成功响应逻辑。

### 1.4 当前仍然存在的不足

`project` 不是完全收尾状态，当前还存在这些现实问题：

1. `project-settings` 还没有完整 REST 面
   现在对外主要还是核心项目 CRUD。

2. JSON Schema 还偏基础
   当前更多是结构校验，还没有系统性加上长度、格式、枚举边界等更细规则。

3. 整个 service 还没有统一测试基建覆盖到所有模块
   目前只是先把 `project` 模块跑通了样板测试。

## 2. 其他模块应该遵守的标准

下面这套规范，建议作为后续所有 service 模块的默认标准。

## 2.1 标准目录结构

推荐结构如下：

```text
apps/service/src/modules/example/
├── __tests__/
│   ├── example.routes.test.ts
│   └── example.service.test.ts
├── errors.ts
├── index.ts
├── repositories/
│   ├── index.ts
│   └── example.repository.ts
├── routes/
│   ├── index.ts
│   └── example.routes.ts
├── schemas/
│   ├── index.ts
│   └── example.schema.ts
├── services/
│   ├── index.ts
│   └── example.service.ts
└── types.ts
```

原则如下：

- 目录分层必须体现职责，而不是按“文件多了再拆”。
- `index.ts` 只做公共导出和模块工厂。
- 不要把 route、service、repository 全堆在模块根目录。
- 测试放在模块内 `__tests__`，共享测试 helper 放在 `apps/service/test/helpers/`。

## 2.2 Route 层规范

Route 层只允许做这几件事：

- 注册 URL、method、schema
- 读取 `params`、`query`、`body`
- 调用 service
- 返回成功响应

Route 层不要做这些事：

- 不要自己写错误状态码映射
- 不要自己拼统一错误 envelope
- 不要直接访问 Prisma
- 不要直接操作文件系统或外部服务
- 不要堆大量 schema 常量在同一个 route 文件里

推荐示例：

```ts
app.post<{ Body: CreateExampleBody }>(
  "/examples",
  { schema: createExampleRouteSchema },
  async (request) => {
    const example = await exampleService.createExample(request.body)

    return {
      ok: true,
      example,
    }
  },
)
```

## 2.3 Schema 层规范

Schema 统一放在 `schemas/` 目录，默认优先使用 Fastify 原生 JSON Schema。

规范如下：

- 一个路由文件对应一组 schema 文件，避免 giant router file
- body、params、query、response 都尽量显式声明
- 能交给 Fastify/Ajv 做的结构校验，不要回退到 route 内手写 `zod.safeParse`
- schema 文件应同时导出必要的 TS type，减少 route 层重复定义

如果后续确实有特殊需求要用 Zod，也应明确说明原因，不要模块间一半 JSON Schema、一半手写解析，形成混乱。

## 2.4 Service 层规范

Service 层是模块的业务中心，负责：

- 业务语义校验
- 编排多个 repository
- 编排外部 gateway 或文件服务
- 统一收口未知错误
- 把空结果或非法状态转换为业务错误

Service 层不要做这些事：

- 不要返回 `reply.status(...)`
- 不要依赖 Fastify request/reply 对象
- 不要直接耦合 HTTP 层概念，除了错误本身携带 `statusCode`

推荐模式：

```ts
export function createExampleService(args: {
  exampleRepository: ExampleRepository
}) {
  const { exampleRepository } = args

  async function getExample(id: string) {
    if (!id.trim()) {
      throw createExampleError.invalidExampleId()
    }

    try {
      const example = await exampleRepository.getById(id)
      if (!example) {
        throw createExampleError.notFound(id)
      }
      return example
    } catch (error) {
      if (error instanceof ExampleError) {
        throw error
      }

      throw createExampleError.internalError("Failed to get example", error)
    }
  }

  return {
    getExample,
  }
}
```

## 2.5 Repository 层规范

Repository 层只负责数据访问，不负责业务语义扩散。

Repository 层职责：

- Prisma 读写
- 数据库异常转换
- domain model 映射
- 必要的底层数据预处理

Repository 层不要做这些事：

- 不要感知 Fastify
- 不要拼 HTTP 响应
- 不要维护业务流程状态机
- 不要偷偷读全局单例数据库，优先走工厂注入

推荐模式：

- `createExampleRepository(prisma)`
- repository 返回 domain object 或 `null`
- service 再决定是否转成 `NOT_FOUND`

这点非常重要：

- `null` 是数据层结果
- `NOT_FOUND` 是业务层语义

不要把两者混成一层。

## 2.6 错误处理规范

统一遵守 [service-error-handling-guide.md](./service-error-handling-guide.md)。

模块内错误规范如下：

- 每个模块只保留一个主错误类，例如 `ProjectError`
- 每个模块只保留一个错误工厂，例如 `createProjectError`
- `statusCode`、默认 `message`、`details` 规则都集中写在工厂里
- route 不再维护 `mapErrorToStatus`
- 未知错误统一包装成 `internalError(..., cause)`

不推荐做法：

- `PROJECT_ERROR_STATUS_MAP`
- `PROJECT_ERROR_MESSAGES`
- `RepositoryError + ServiceError + ValidationError` 三层并存
- 各文件里散落 `new AppError(...)`

## 2.7 模块入口规范

模块根目录 `index.ts` 只做两类事：

1. 导出模块公开类型和 factory
2. 提供模块 composition root

推荐参考 [apps/service/src/modules/project/index.ts](../apps/service/src/modules/project/index.ts)

建议保留的公开入口：

- domain types
- error factory
- repository factory
- service factory
- `registerXxxModuleRoutes`
- `createXxxModule({ prisma })`

不建议继续保留的遗留形式：

- `getDefaultXxxModule()`
- `listXxx()`
- `createXxx()`
- 这类基于默认单例的跨模块 wrapper export

原因很简单：

- 隐藏依赖
- 不利于测试
- 容易形成模块级全局状态

## 2.8 测试规范

当前推荐测试策略已经在 `project` 模块里落地了一版。

推荐顺序：

1. route 集成测试
2. 少量 service 行为测试
3. 少量 repository 边界测试

默认工具链：

- `vitest`
- Fastify `inject`
- 临时 SQLite + Prisma 真实读写

当前参考文件：

- [apps/service/src/modules/project/__tests__/project.routes.test.ts](../apps/service/src/modules/project/__tests__/project.routes.test.ts)
- [apps/service/test/helpers/project-test-app.ts](../apps/service/test/helpers/project-test-app.ts)
- [apps/service/test/helpers/test-database.ts](../apps/service/test/helpers/test-database.ts)

测试规范要求：

- 优先测真实 HTTP 行为，而不是 mock 调用次数
- 至少覆盖 `200`、`400`、`404`、`409`、`500`
- 至少覆盖一条 schema validation 错误路径
- 至少覆盖一条统一 error envelope 断言

## 3. 其他模块重构时的迁移顺序

建议其他模块按下面顺序收敛，不要一次全推翻：

1. 先抽 `errors.ts`
   把错误体系统一成 `AppError` 子类 + factory-only。

2. 再拆 `routes/` 和 `schemas/`
   先把 router 瘦身，让 route 只剩 HTTP 接口语义。

3. 再拆 `services/` 和 `repositories/`
   把数据访问和业务编排分开。

4. 最后补模块内 `__tests__`
   先上 route 集成测试，锁住行为。

这样风险最小，因为每一步都能保持系统可运行。

## 4. 评审检查清单

后续任何一个 service 模块，如果要评估“是否达标”，至少检查下面这些点：

- 是否有明确的 `routes/`、`services/`、`repositories/`、`schemas/`
- route 是否只负责接口声明和成功响应
- schema 是否从 route 中拆出
- repository 是否通过工厂接收 Prisma
- service 是否通过工厂接收 repository
- 是否有模块自己的 `errors.ts`
- 是否使用 factory-only 错误结构
- 是否避免默认单例 wrapper export
- 是否有模块内 `__tests__`
- 是否至少有 route 集成测试覆盖主路径和错误路径

如果以上都满足，这个模块基本就达到了当前 `service` 的推荐实现标准。

## 5. 结论

`project` 模块当前可以作为 `apps/service` 的第一个标准样板模块。

它不是“所有设计都完美”，但它已经证明下面这套组合是有效的：

- Fastify route + JSON Schema
- service / repository 分层
- Prisma 工厂注入
- factory-only 错误模型
- 模块内测试 + 共享测试 helper

后续 `tasks`、`filesystem`、`capability` 等模块，都建议按这个方向逐步收敛，而不是继续维持“部分新、部分旧、局部手写”的混合状态。
