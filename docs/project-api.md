# Project 接口文档

本文档描述当前 `project` 相关后端接口（Service + Server Actions）的真实行为，用于 client 对接和后续重构基线。

## 1. 概览

- 基础模型：`Project`
- 数据存储：SQLite（`bun:sqlite`）
- 数据文件位置：`getAppConfig().project.dataFile`
- 兼容迁移：启动时可从旧 `~/.harbor/data/workspaces.json` 导入
- 当前 action 返回统一结果类型：`ProjectActionResult`

## 2. 数据模型

来源：[src/services/project/types.ts](../src/services/project/types.ts)

```ts
type Project = {
  id: string
  name: string
  path: string
  createdAt: string
}
```

`createdAt` 使用 ISO 时间字符串（`new Date().toISOString()`）。

## 3. Service 层接口

来源：[src/services/project/project.repository.ts](../src/services/project/project.repository.ts)

### 3.1 `listProjects()`

```ts
function listProjects(): Promise<Project[]>
```

- 读取 `projects` 表全部数据
- 排序规则：`ORDER BY created_at DESC`（新建在前）
- 失败时抛出 `ProjectRepositoryError(code = "DB_READ_ERROR")`

### 3.2 `getProjectById(id)`

```ts
function getProjectById(id: string): Promise<Project | null>
```

- 会先 `trim()` 处理 `id`
- 空字符串直接返回 `null`（不会抛错）
- 查询异常抛出 `ProjectRepositoryError(code = "DB_READ_ERROR")`

### 3.3 `addProject({ path, name? })`

```ts
function addProject(input: { path: string; name?: string }): Promise<Project>
```

路径处理与校验：

- `path.trim()` 为空：抛 `INVALID_PATH`
- 相对路径会基于 `getAppConfig().fileBrowser.rootDirectory` 解析
- 使用 `realpath` 获取规范化绝对路径
- 路径不存在或不可访问：抛 `PATH_NOT_FOUND`
- 路径不是目录：抛 `NOT_A_DIRECTORY`

命名规则：

- `name` 传入且非空（trim 后）则使用该值
- 否则默认 `basename(canonicalPath)`

写入规则：

- 主键 `id` 使用 `randomUUID()`
- `createdAt` 为当前 ISO 时间
- `path` 唯一约束冲突：抛 `DUPLICATE_PATH`
- 其他写入失败：抛 `DB_WRITE_ERROR`

### 3.4 `deleteProject(id)`

```ts
function deleteProject(id: string): Promise<boolean>
```

- `id.trim()` 为空：抛 `INVALID_PROJECT_ID`
- 存在则删除并返回 `true`
- 不存在返回 `false`（不会抛错）
- 删除异常抛 `DB_WRITE_ERROR`

### 3.5 异常类型

```ts
class ProjectRepositoryError extends Error {
  code: ProjectErrorCode
}
```

`ProjectErrorCode` 定义如下：

- `INVALID_PATH`
- `PATH_NOT_FOUND`
- `NOT_A_DIRECTORY`
- `DUPLICATE_PATH`
- `INVALID_PROJECT_ID`
- `DB_READ_ERROR`
- `DB_WRITE_ERROR`

## 4. Server Actions 接口

来源：[src/app/actions/projects.ts](../src/app/actions/projects.ts)

### 4.1 统一返回结构

```ts
type ProjectActionResult = {
  ok: boolean
  projects: Project[]
  error?: {
    code: string
    message: string
  }
}
```

说明：

- action 返回时总是携带 `projects`
- 成功时 `ok = true`，`error` 为空
- 失败时 `ok = false`，`error` 包含 `code/message`

### 4.2 `addProjectAction({ path, name? })`

```ts
function addProjectAction(input: {
  path: string
  name?: string
}): Promise<ProjectActionResult>
```

行为：

1. 调用 `addProject(input)`
2. 成功后调用 `listProjects()`，返回最新列表
3. 异常时：
   - 错误通过 `mapError` 映射
   - 仍尝试 `listProjects()`；若再次失败则降级为空数组

### 4.3 `listProjectsAction()`

```ts
function listProjectsAction(): Promise<ProjectActionResult>
```

行为：

- 成功：`{ ok: true, projects }`
- 失败：`{ ok: false, projects: [], error }`

### 4.4 `deleteProjectAction({ id })`

```ts
function deleteProjectAction(input: {
  id: string
}): Promise<ProjectActionResult>
```

行为：

1. 调用 `deleteProject(input.id)`
2. 若返回 `false`（未找到）：
   - 返回 `ok: false`
   - `error.code = "NOT_FOUND"`
   - 同时返回当前 `projects` 列表
3. 删除成功返回 `ok: true` + 最新 `projects`
4. 出现异常时走 `mapError`，并尽量附带最新 `projects`（失败则空数组）

### 4.5 Action 错误映射

- 若异常是 `ProjectRepositoryError`：直接透传 `code/message`
- 其他未知错误：映射为
  - `code: "INTERNAL_ERROR"`
  - `message: "Unexpected error occurred while updating projects."`

## 5. 存储与迁移细节

### 5.1 SQLite 初始化

- 打开 DB 前确保目录存在（`mkdirSync(..., { recursive: true })`）
- 启用：
  - `PRAGMA journal_mode = WAL`
  - `PRAGMA foreign_keys = ON`

表结构：

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
)
```

### 5.2 旧数据迁移（workspaces -> projects）

迁移触发条件：

- 仅当 `projects` 表当前为空时执行

迁移来源：

- `~/.harbor/data/workspaces.json`

迁移规则：

- 读取 `workspaces[]` 中合法项（`id/name/path/createdAt` 均为字符串）
- 通过事务批量 `INSERT OR IGNORE INTO projects`
- 非法 JSON、文件不存在、字段不完整都会被安全忽略（不抛出）

## 6. HTTP API（供 useQuery/useMutation 使用）

当前新增了基于 Route Handler 的项目接口，可直接用于客户端 `fetch`。

### 6.1 `GET /api/projects`

- 成功：`200`
  - `{ ok: true, projects: Project[] }`
- 失败：`4xx/5xx`
  - `{ ok: false, projects: [], error }`

### 6.2 `POST /api/projects`

请求体：

```json
{
  "path": "string",
  "name": "string (optional)"
}
```

- 成功：`200`
  - `{ ok: true, projects: Project[] }`（返回新增后的完整列表）
- 参数错误：`400`（`INVALID_REQUEST_BODY`）
- 业务错误：
  - `DUPLICATE_PATH` -> `409`
  - `INVALID_PATH/PATH_NOT_FOUND/NOT_A_DIRECTORY` -> `400`
  - 其他 -> `500`

### 6.3 `DELETE /api/projects/:id`

- 成功：`200`
  - `{ ok: true, projects: Project[] }`
- 不存在：`404`
  - `{ ok: false, projects: Project[], error: { code: "NOT_FOUND", ... } }`
- 业务错误（如 `INVALID_PROJECT_ID`）：`400`

### 6.4 `PUT /api/projects/:id`

请求体：

```json
{
  "path": "string (optional)",
  "name": "string (optional)"
}
```

约束：

- 至少提供一个字段：`path` 或 `name`

- 成功：`200`
  - `{ ok: true, projects: Project[] }`（返回更新后的完整列表）
- 参数错误：`400`（`INVALID_REQUEST_BODY`）
- 不存在：`404`（`NOT_FOUND`）
- 业务错误：
  - `DUPLICATE_PATH` -> `409`
  - `INVALID_PATH/PATH_NOT_FOUND/NOT_A_DIRECTORY` -> `400`
  - 其他 -> `500`

## 7. 对接建议

- client 侧优先依赖 `/api/projects`，不直接耦合 repository 抛错细节
- 对 `error.code` 做分支处理时，至少覆盖：
  - `NOT_FOUND`
  - `DUPLICATE_PATH`
  - `INVALID_PATH`
  - `PATH_NOT_FOUND`
  - `NOT_A_DIRECTORY`
  - `INTERNAL_ERROR`
