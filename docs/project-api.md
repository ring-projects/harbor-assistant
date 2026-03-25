# Project API

本文档描述当前 Harbor `project` 模块的真实运行时契约。

结论先说：

- 当前前端不再通过 Next.js BFF `/api/*` 转发 `project` 请求。
- Web 直接请求 executor service 的 `/v1/projects/*`。
- `project` 当前同时支持：
  - 创建
  - 查询
  - 更新
  - 更新 settings
  - 归档 / 恢复
  - 永久删除

---

## 1. 接入方式

Web 通过环境变量 `NEXT_PUBLIC_EXECUTOR_API_BASE_URL` 直连后端 service。

实现位置：

- 前端 URL 解析：[executor-service-url.ts](../apps/web/src/lib/executor-service-url.ts)
- 前端 project client：[project-api-client.ts](../apps/web/src/modules/projects/api/project-api-client.ts)
- 后端 project routes：[index.ts](../apps/service/src/modules/project/routes/index.ts)

示例：

```bash
NEXT_PUBLIC_EXECUTOR_API_BASE_URL=http://127.0.0.1:3400
```

---

## 2. Project 数据模型

来源：[project.ts](../apps/service/src/modules/project/domain/project.ts)

```ts
type ProjectStatus = "active" | "archived" | "missing"

type ProjectExecutionPolicy = {
  defaultExecutor: string | null
  defaultModel: string | null
  defaultExecutionMode: string | null
  maxConcurrentTasks: number
}

type ProjectRetentionPolicy = {
  logRetentionDays: number | null
  eventRetentionDays: number | null
}

type ProjectSkillPolicy = {
  harborSkillsEnabled: boolean
  harborSkillProfile: string | null
}

type ProjectSettings = {
  execution: ProjectExecutionPolicy
  retention: ProjectRetentionPolicy
  skills: ProjectSkillPolicy
}

type Project = {
  id: string
  slug: string
  name: string
  description: string | null
  rootPath: string
  normalizedPath: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  lastOpenedAt: string | null
  settings: ProjectSettings
}
```

说明：

- `rootPath` 表示当前项目根目录。
- `normalizedPath` 是 canonical path，用于唯一性约束。
- `status` 当前支持 `active | archived | missing`。
- 所有时间字段在 HTTP 响应中都是 ISO 字符串。

默认 settings：

```ts
{
  execution: {
    defaultExecutor: "codex",
    defaultModel: null,
    defaultExecutionMode: "safe",
    maxConcurrentTasks: 1,
  },
  retention: {
    logRetentionDays: 30,
    eventRetentionDays: 7,
  },
  skills: {
    harborSkillsEnabled: false,
    harborSkillProfile: "default",
  },
}
```

---

## 3. 路由总览

当前 `project` 模块对外暴露以下路由：

1. `GET /v1/projects`
2. `POST /v1/projects`
3. `GET /v1/projects/:id`
4. `PATCH /v1/projects/:id`
5. `DELETE /v1/projects/:id`
6. `GET /v1/projects/:id/settings`
7. `PATCH /v1/projects/:id/settings`
8. `POST /v1/projects/:id/archive`
9. `POST /v1/projects/:id/restore`

---

## 4. 具体接口

### 4.1 `GET /v1/projects`

返回所有项目列表。

成功响应：

```json
{
  "ok": true,
  "projects": [
    {
      "id": "project-1",
      "slug": "harbor-assistant",
      "name": "Harbor Assistant",
      "description": null,
      "rootPath": "/tmp/harbor-assistant",
      "normalizedPath": "/tmp/harbor-assistant",
      "status": "active",
      "createdAt": "2026-03-25T04:00:00.000Z",
      "updatedAt": "2026-03-25T04:00:00.000Z",
      "archivedAt": null,
      "lastOpenedAt": null,
      "settings": {
        "execution": {
          "defaultExecutor": "codex",
          "defaultModel": null,
          "defaultExecutionMode": "safe",
          "maxConcurrentTasks": 1
        },
        "retention": {
          "logRetentionDays": 30,
          "eventRetentionDays": 7
        },
        "skills": {
          "harborSkillsEnabled": false,
          "harborSkillProfile": "default"
        }
      }
    }
  ]
}
```

### 4.2 `POST /v1/projects`

创建项目。

请求体：

```json
{
  "id": "project-1",
  "name": "Harbor Assistant",
  "rootPath": "~/workspace/harbor-assistant",
  "description": "optional"
}
```

说明：

- 当前后端要求 `id` 显式传入。
- Web client 当前在浏览器侧使用 `crypto.randomUUID()` 生成 `id`。
- `rootPath` 会先经过 path policy canonicalize，再写入 `rootPath` 与 `normalizedPath`。

成功响应：

```json
{
  "ok": true,
  "project": {
    "...": "Project"
  }
}
```

常见错误：

- `400 INVALID_REQUEST_BODY`
- `400 INVALID_REQUEST_BODY`：例如 `rootPath` 为空
- `409 DUPLICATE_PATH`
- `409 DUPLICATE_SLUG`

### 4.3 `GET /v1/projects/:id`

按 `id` 读取项目。

成功响应：

```json
{
  "ok": true,
  "project": {
    "...": "Project"
  }
}
```

常见错误：

- `404 PROJECT_NOT_FOUND`

### 4.4 `PATCH /v1/projects/:id`

更新项目 profile 或根路径。

请求体：

```json
{
  "name": "Harbor Service",
  "description": "Core service workspace",
  "rootPath": "~/workspace/harbor-service"
}
```

说明：

- 三个字段都是可选的，但至少要传一个。
- `name` / `description` 更新 profile。
- `rootPath` 会重新 canonicalize，并同步更新 `rootPath` 与 `normalizedPath`。

成功响应：

```json
{
  "ok": true,
  "project": {
    "...": "Project"
  }
}
```

常见错误：

- `400 INVALID_REQUEST_BODY`
- `404 PROJECT_NOT_FOUND`
- `409 DUPLICATE_PATH`
- `409 DUPLICATE_SLUG`

### 4.5 `DELETE /v1/projects/:id`

永久删除项目记录。

说明：

- 这是删除 Harbor 中的项目元数据记录。
- 当前语义不删除本地工作区文件。

成功响应：

```json
{
  "ok": true,
  "projectId": "project-1"
}
```

常见错误：

- `404 PROJECT_NOT_FOUND`

### 4.6 `GET /v1/projects/:id/settings`

读取项目 settings。

成功响应：

```json
{
  "ok": true,
  "settings": {
    "execution": {
      "defaultExecutor": "codex",
      "defaultModel": null,
      "defaultExecutionMode": "safe",
      "maxConcurrentTasks": 1
    },
    "retention": {
      "logRetentionDays": 30,
      "eventRetentionDays": 7
    },
    "skills": {
      "harborSkillsEnabled": false,
      "harborSkillProfile": "default"
    }
  }
}
```

常见错误：

- `404 PROJECT_NOT_FOUND`

### 4.7 `PATCH /v1/projects/:id/settings`

局部更新 settings。

请求体示例：

```json
{
  "execution": {
    "defaultExecutor": "codex",
    "defaultExecutionMode": "connected",
    "maxConcurrentTasks": 4
  },
  "retention": {
    "logRetentionDays": 14
  }
}
```

说明：

- `execution` / `retention` / `skills` 都是可选块。
- 每个块内也是 partial update。
- 数值字段必须是正整数，或 `null`。

成功响应：

```json
{
  "ok": true,
  "project": {
    "...": "Project"
  }
}
```

常见错误：

- `400 INVALID_REQUEST_BODY`
- `404 PROJECT_NOT_FOUND`

### 4.8 `POST /v1/projects/:id/archive`

将项目置为归档状态。

成功响应：

```json
{
  "ok": true,
  "project": {
    "...": "Project",
    "status": "archived"
  }
}
```

常见错误：

- `404 PROJECT_NOT_FOUND`
- `409 INVALID_PROJECT_STATE`

### 4.9 `POST /v1/projects/:id/restore`

恢复已归档项目。

成功响应：

```json
{
  "ok": true,
  "project": {
    "...": "Project",
    "status": "active"
  }
}
```

常见错误：

- `404 PROJECT_NOT_FOUND`
- `409 INVALID_PROJECT_STATE`

---

## 5. 错误码

来源：

- service app error 映射：[project-app-error.ts](../apps/service/src/modules/project/project-app-error.ts)
- 全局错误码：[errors.ts](../apps/service/src/constants/errors.ts)

`project` 相关对外错误码主要包括：

- `INVALID_REQUEST_BODY`
- `PROJECT_NOT_FOUND`
- `DUPLICATE_PATH`
- `DUPLICATE_SLUG`
- `INVALID_PROJECT_STATE`
- `INTERNAL_ERROR`

错误响应结构：

```json
{
  "ok": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "project not found"
  }
}
```

---

## 6. 前端对接约定

当前前端 project 模块的真实行为：

1. 使用 `NEXT_PUBLIC_EXECUTOR_API_BASE_URL` 拼接 service URL。
2. 直接请求 `/v1/projects/*`，不再经过 `/api/projects`。
3. 创建项目时，浏览器生成 `id`。
4. 删除项目后，前端会：
   - 从 `projects` 查询缓存移除该项目
   - 清理 project detail / settings 缓存
   - 如果当前激活项目被删，则清空 `activeProjectId`

相关实现：

- 前端 API client：[project-api-client.ts](../apps/web/src/modules/projects/api/project-api-client.ts)
- 前端 hooks：[use-projects.ts](../apps/web/src/modules/projects/hooks/use-projects.ts)

---

## 7. 当前非目标

以下内容不属于当前 `project` API：

- 不通过 Next Route Handlers 做项目代理转发
- 不通过 Server Actions 暴露项目 CRUD
- 不在删除项目时自动删除本地目录
- 不在 `project` 模块内混入 filesystem / git 读写逻辑
