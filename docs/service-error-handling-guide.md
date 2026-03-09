# Harbor Service Error Handling Guide

本文整理 `apps/service` 当前的错误处理实现，并给出后续新增模块时的标准接入方式。

目标只有三个：

1. 业务代码直接抛出结构化错误。
2. Fastify 在一个地方统一收口错误响应。
3. Route 层不再维护各自的错误映射表。

## 1. 当前实现概览

当前 `apps/service` 的错误处理能力分成三层。

### 1.1 共享错误基类

文件：[apps/service/src/lib/errors/app-error.ts](/Users/qiuhao/workspace/harbor-assistant/apps/service/src/lib/errors/app-error.ts)

当前所有可被全局错误处理器识别的业务错误，都应该继承 `AppError`。

`AppError` 统一定义了这些字段：

- `code`: 业务错误码，给前端和日志系统使用。
- `statusCode`: HTTP 状态码。
- `message`: 面向客户端的错误消息。
- `details`: 结构化错误上下文，可选。
- `headers`: 需要附加到响应上的 header，可选。
- `cause`: 原始底层错误，通过 `super(message, { cause })` 传递。

最重要的约束是：

- 只要错误对象是 `AppError`，全局 handler 就会按它的 `statusCode` 和 `code` 输出响应。
- 如果不是 `AppError`，系统会把它包装成 `INTERNAL_ERROR`。

### 1.2 错误归一化与响应序列化

文件：[apps/service/src/lib/errors/error-response.ts](/Users/qiuhao/workspace/harbor-assistant/apps/service/src/lib/errors/error-response.ts)

这里负责两件事：

1. `toAppError(error)`
   把未知错误归一化成 `AppError`。

2. `toErrorResponse(error, requestId)`
   把错误转换成统一响应结构：

```ts
{
  ok: false,
  error: {
    code: string,
    message: string,
    details?: unknown,
    requestId?: string
  }
}
```

当前 `toAppError` 的行为：

- 如果本来就是 `AppError`，直接返回。
- 如果是 Fastify validation error，转成 `INVALID_REQUEST_BODY`。
- 如果是普通 `Error`，转成 `INTERNAL_ERROR`。
- 如果是非 `Error` 值，仍然转成 `INTERNAL_ERROR`。

### 1.3 Fastify 全局错误处理插件

文件：[apps/service/src/plugins/error-handler.ts](/Users/qiuhao/workspace/harbor-assistant/apps/service/src/plugins/error-handler.ts)

插件注册了两个入口：

1. `setNotFoundHandler`
   统一处理 404 route not found。

2. `setErrorHandler`
   统一处理所有未被局部消费的错误。

当前行为：

- `statusCode >= 500` 记 `error` 日志。
- `statusCode < 500` 记 `warn` 日志。
- 如果错误上有 `headers`，会附加到响应。
- 最终响应统一走 `toErrorResponse(...)`。

这个插件已经在应用初始化时注册：

文件：[apps/service/src/app.ts](/Users/qiuhao/workspace/harbor-assistant/apps/service/src/app.ts)

## 2. 当前各模块的接入方式

### 2.1 Project 模块

文件：[apps/service/src/modules/project/errors.ts](/Users/qiuhao/workspace/harbor-assistant/apps/service/src/modules/project/errors.ts)

`project` 模块当前采用的是推荐结构：

- `ProjectError extends AppError`
- `createProjectError.*` 工厂函数统一创建错误
- `routes/`、`services/`、`repositories/` 职责分离
- route validation 使用 Fastify 原生 JSON Schema
- 没有单独的 route mapper
- 没有多层 repository/service/validation error class

这是当前最推荐的模块写法。

它的特点是：

- `code`、`statusCode`、默认 `message` 都集中在 factory 内。
- 新增一个错误，只需要在 `createProjectError` 中新增一个工厂函数。
- service / repository 调用处只负责 `throw createProjectError.xxx(...)`。

### 2.2 Task 模块

文件：

- [apps/service/src/modules/tasks/task.service.ts](/Users/qiuhao/workspace/harbor-assistant/apps/service/src/modules/tasks/task.service.ts)
- [apps/service/src/modules/tasks/task.repository.ts](/Users/qiuhao/workspace/harbor-assistant/apps/service/src/modules/tasks/task.repository.ts)

`task` 模块当前已经接到 `AppError` 体系里，但还没有完全收敛成 factory-only 风格。

当前状态：

- `TaskServiceError extends AppError`
- `TaskRepositoryError extends AppError`
- 业务代码里仍然有较多 `new TaskServiceError(...)`

这套实现已经能被全局 handler 正确处理，但一致性不如 `project` 模块。

如果后续继续整理，建议把 `task` 也改成：

- `TaskError extends AppError`
- `createTaskError.*`

### 2.3 Filesystem 模块

文件：[apps/service/src/modules/filesystem/types.ts](/Users/qiuhao/workspace/harbor-assistant/apps/service/src/modules/filesystem/types.ts)

`filesystem` 模块当前是一个过渡态：

- `FileSystemError extends AppError`
- `createFileSystemError.*` 统一创建错误
- 已经拆出 `routes/`、`services/`、`repositories/`、`schemas/`

它已经能被全局 handler 正常识别，并且已经开始向统一模块结构收敛。

## 3. Route 层当前约束

当前 `project`、`tasks`、`filesystem` 三类 JSON 接口都已经切到“抛错即可”的模式。

对应文件：

- [apps/service/src/modules/project/routes/project.routes.ts](/Users/qiuhao/workspace/harbor-assistant/apps/service/src/modules/project/routes/project.routes.ts)
- [apps/service/src/modules/tasks/routes/tasks.routes.ts](/Users/qiuhao/workspace/harbor-assistant/apps/service/src/modules/tasks/routes/tasks.routes.ts)
- [apps/service/src/modules/filesystem/routes/filesystem.routes.ts](/Users/qiuhao/workspace/harbor-assistant/apps/service/src/modules/filesystem/routes/filesystem.routes.ts)

当前约束如下：

- Route 不负责把业务错误映射成 HTTP 响应。
- Route 不维护 `mapXxxError`。
- Route 只负责声明 `schema`、调用 service、返回成功结果。
- 校验失败优先交给 Fastify 的 schema validation，再由全局 error handler 统一转换成错误响应。

唯一例外是 SSE 或 hijack 场景。

例如 `tasks.events` 的 SSE 分支使用了 `reply.hijack()`，这类请求已经脱离 Fastify 的标准响应通道，因此需要在局部自行捕获错误并转换成流事件。

这类场景的原则是：

- 流式协议内部错误在局部消费。
- 普通 JSON 接口错误交给全局 `setErrorHandler`。

## 4. 系统接入 Error 能力的标准做法

后续新增一个模块时，按下面的步骤接入。

### Step 1: 定义模块错误类

在模块内创建 `errors.ts`。

推荐写法：

```ts
import { AppError } from "../../lib/errors/app-error"

export type ExampleErrorCode =
  | "EXAMPLE_NOT_FOUND"
  | "INVALID_EXAMPLE_INPUT"
  | "EXAMPLE_CONFLICT"
  | "EXAMPLE_INTERNAL_ERROR"

export class ExampleError extends AppError {}
```

如果模块像 `project` 一样需要额外字段，也可以扩展构造函数。

### Step 2: 定义 factory-only 错误工厂

推荐直接在同一个 `errors.ts` 中定义：

```ts
export const createExampleError = {
  invalidInput: (details?: unknown) =>
    new ExampleError(
      "INVALID_EXAMPLE_INPUT",
      400,
      "Example input is invalid",
      { details },
    ),

  notFound: (id: string) =>
    new ExampleError(
      "EXAMPLE_NOT_FOUND",
      404,
      `Example not found: ${id}`,
      { details: { id } },
    ),

  conflict: (name: string) =>
    new ExampleError(
      "EXAMPLE_CONFLICT",
      409,
      `Example already exists: ${name}`,
      { details: { name } },
    ),

  internalError: (message = "Example internal error", cause?: unknown) =>
    new ExampleError("EXAMPLE_INTERNAL_ERROR", 500, message, { cause }),
}
```

注意点：

- `statusCode` 直接写在工厂里。
- 默认消息也直接写在工厂里。
- 不再维护单独的 status map / message map / code const map。

### Step 3: Repository / Service 抛 factory 错误

推荐模式：

```ts
throw createExampleError.notFound(exampleId)
```

不推荐模式：

```ts
throw new AppError("EXAMPLE_NOT_FOUND", 404, "...")
```

原因：

- 直接 `new AppError(...)` 会让错误定义散落到业务代码里。
- 统一工厂能保持模块语义集中。

### Step 4: Route 直接抛，不做局部错误映射

推荐：

```ts
app.get("/examples/:id", async (request) => {
  const example = await getExample(...)
  return { ok: true, example }
})
```

不推荐：

```ts
try {
  ...
} catch (error) {
  return reply.status(...).send(...)
}
```

除非是以下场景，否则不要局部消费错误：

- SSE
- WebSocket
- `reply.hijack()`
- 明确需要把错误转成协议内事件，而不是 HTTP JSON 响应

### Step 5: 未知错误统一包成 internal error

service 或 repository 在捕获未知错误时，推荐这样做：

```ts
try {
  ...
} catch (error) {
  if (error instanceof ExampleError) {
    throw error
  }

  throw createExampleError.internalError("Failed to ...", error)
}
```

这样可以保证：

- 业务已知错误原样透传
- 未知错误保留原始 `cause`
- HTTP 返回仍然是结构化的 `INTERNAL_ERROR`

## 5. 推荐的模块内分层规则

为了避免错误边界重新混乱，后续建议遵循以下规则。

### Repository 层

Repository 负责：

- 数据库读取 / 写入
- 文件系统访问
- 外部存储交互

Repository 可以抛：

- 模块自己的结构化错误
- 基于底层异常包装后的 `internalError` / `dbReadError` / `dbWriteError`

Repository 不要做：

- HTTP 响应拼装
- `reply.status(...).send(...)`

### Service 层

Service 负责：

- 业务语义校验
- 聚合多个 repository / gateway 调用
- 把空结果转换成业务错误，例如 `notFound`

Service 可以抛：

- `createXxxError.invalid...`
- `createXxxError.notFound(...)`
- `createXxxError.conflict(...)`
- `createXxxError.internalError(...)`

### Route 层

Route 负责：

- 读取 `params` / `query` / `body`
- 调用 service
- 返回成功响应

Route 不负责：

- 各模块错误码到状态码的映射
- 统一错误 envelope

## 6. 当前统一错误响应格式

当前系统统一错误响应如下：

```json
{
  "ok": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found: abc",
    "details": {
      "projectId": "abc"
    },
    "requestId": "req-123"
  }
}
```

字段说明：

- `code`: 给前端和调用方判断错误类型。
- `message`: 给人读的错误信息。
- `details`: 可选，结构化上下文。
- `requestId`: 当前请求标识，便于排查日志。

## 7. 当前推荐与后续整理建议

当前最推荐参考的是 `project` 模块，因为它已经最接近目标形态。

后续建议按优先级继续整理：

1. 把 `task` 模块也改成 factory-only 结构。
2. 继续收紧 `filesystem` 模块的配置注入和测试覆盖。
3. 优先使用 Fastify 原生 JSON Schema，避免在 route 内手写 `zod.safeParse`。
4. 给关键错误路径补测试，至少覆盖 400、404、409、500、SSE error event。

## 8. 接入检查清单

新增模块时，提交前至少检查这些点：

- 是否继承了 `AppError`
- 是否使用了模块内统一的 `createXxxError`
- 是否避免了 route 层局部错误映射
- 是否把未知错误包装成 `internalError(..., cause)`
- 是否遵守统一错误响应结构
- 是否只在流式协议场景局部消费错误

如果以上几点都满足，这个模块就算正确接入了当前的 error 能力。
