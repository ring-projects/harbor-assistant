# Bootstrap Filesystem API Design

## 1. 文档信息

- 文档名称：Bootstrap Filesystem API Design
- 日期：2026-03-26
- 状态：Proposed Canonical Design
- 适用范围：
  - `apps/service/src/modules/filesystem`
  - `apps/service/src/routes/v1`
  - `apps/web/src/components/directory-picker`
  - project creation onboarding flow
- 关联文档：
  - [filesystem-context-design-2026-03-24.md](./filesystem-context-design-2026-03-24.md)
  - [project-context-design-2026-03-24.md](./project-context-design-2026-03-24.md)
  - [project-api.md](./project-api.md)
  - [service-error-handling-guide.md](./service-error-handling-guide.md)

## 2. 文档目标

这份文档只解决一个具体问题：

在“项目尚未创建”的阶段，为前端目录选择器提供一组受控、可审计、root-scoped 的文件系统浏览 API。

它要回答的问题只有六个：

1. 为什么当前不能直接复用 project-scoped filesystem API
2. pre-project filesystem API 的边界应该是什么
3. route contract 应该长什么样
4. allowed roots 应该如何配置与约束
5. 错误模型应该如何定义
6. 这组能力在模块层应该如何落地，而不破坏现有 context 边界

## 3. 问题背景

当前前端 `CreateProject` 组件要求用户手动输入绝对路径，这个交互成本偏高，也容易出错。

仓库内已经存在目录选择器组件，但它当前调用的是一个并不存在的全局接口：

- 前端调用位置：[apps/web/src/components/directory-picker/hooks/use-directory-entries-query.ts](../apps/web/src/components/directory-picker/hooks/use-directory-entries-query.ts)
- 请求目标：`POST /v1/fs/list`

而当前 service 真正存在的是 project-scoped filesystem API：

- 路由位置：[apps/service/src/modules/filesystem/routes/index.ts](../apps/service/src/modules/filesystem/routes/index.ts)
- 路由形态：`/v1/projects/:projectId/files/*`

这意味着：

1. 现有目录选择器无法直接在“还没有 projectId”的阶段使用
2. 不能简单把旧的 `/v1/fs/list` 复活，否则会重新打开“任意绝对路径浏览”的能力面
3. 需要新增一层 bootstrap / onboarding 阶段的受限目录浏览 API

## 4. 设计原则

### 4.1 只解决 onboarding 浏览，不解决通用文件系统访问

这组 API 只用于“选择项目根目录”。

它不负责：

1. 读取文件内容
2. 写文件
3. 创建目录
4. 编辑器文件树
5. 项目创建后的工作区访问

### 4.2 只允许浏览受控 roots

客户端不能提交任意绝对路径要求 service 直接遍历。

客户端必须先拿到服务端公开的一组 `allowed roots`，后续所有 list / stat 都以 `rootId + relativePath` 为输入。

### 4.3 继续复用 filesystem context 的 root boundary enforcement

`filesystem` context 仍然负责：

1. path resolve
2. canonicalization
3. outside-root reject
4. path existence / directory checks

`project` context 不参与这组 API 的路径安全判断。

### 4.4 route 命名必须显式区分 bootstrap 阶段

不要复活一个看起来像“全局通用 filesystem”的 `/v1/fs/*`。

推荐统一使用：

```text
/v1/bootstrap/filesystem/*
```

这样可以明确表达：

1. 这是 pre-project onboarding capability
2. 它和 `/v1/projects/:projectId/files/*` 不是同一层能力
3. 未来如果收紧或替换，这组接口的生命周期也更容易管理

## 5. 非目标

本设计明确不包括：

1. 浏览器原生 `showDirectoryPicker()` 方案
2. 本机桌面容器专用 IPC 方案
3. 项目创建后的统一文件树 API 重构
4. “自动发现 Git 仓库并批量导入” 能力
5. 多租户权限系统

## 6. 领域边界与依赖方向

### 6.1 `filesystem` context 的角色

`filesystem` 仍然是 supporting context。

在这组 API 里，它负责：

1. allowed root 内的路径解析
2. 目录列表
3. 路径 stat
4. 路径边界与错误分类

### 6.2 `project` context 的角色

`project` 不参与 bootstrap filesystem browse。

`project` 只在最终 `POST /v1/projects` 时接收用户选中的绝对路径作为 `rootPath`。

### 6.3 配置层的角色

allowed roots 应由 service config 提供，而不是由前端、project repository 或 runtime state 决定。

一句话收敛：

```text
Config owns allowed bootstrap roots.
Filesystem owns root-scoped browse semantics.
Project owns project creation after a root has been selected.
```

## 7. API 总览

首版只定义三个接口：

1. `GET /v1/bootstrap/filesystem/roots`
2. `POST /v1/bootstrap/filesystem/list`
3. `GET /v1/bootstrap/filesystem/stat`

首版不定义：

1. `read-text`
2. `write-text`
3. `create-directory`
4. `inspect-project-root`

`inspect-project-root` 可以作为后续增强能力，但不应该阻塞首版目录选择流程。

## 8. 配置模型

### 8.1 服务端配置结构

推荐在 service config 中新增：

```ts
type BootstrapFileSystemRootConfig = {
  id: string
  label: string
  path: string
  isDefault?: boolean
}

type ServiceConfig = {
  // existing fields...
  bootstrapFileSystemRoots: BootstrapFileSystemRootConfig[]
}
```

约束规则：

1. `id` 必须稳定且唯一
2. `label` 给 UI 展示
3. `path` 必须是可 canonicalize 的绝对路径
4. 最多只能有一个 `isDefault: true`
5. 如果配置为空，则 bootstrap filesystem API 整体不应暴露或应返回明确错误

### 8.2 为什么不用客户端传绝对路径

原因很简单：

1. 安全边界会变差
2. 旧的全局浏览能力会被重新打开
3. 难以审计“用户到底能浏览哪些路径”
4. 前端 contract 会和 service 的 boundary enforcement 脱钩

## 9. Route Contract

### 9.1 `GET /v1/bootstrap/filesystem/roots`

用途：

返回前端可浏览的根目录集合。

成功响应：

```json
{
  "ok": true,
  "roots": [
    {
      "id": "workspace",
      "label": "Workspace",
      "path": "/Users/qiuhao/workspace",
      "isDefault": true
    },
    {
      "id": "home",
      "label": "Home",
      "path": "/Users/qiuhao",
      "isDefault": false
    }
  ]
}
```

字段说明：

1. `id`：后续 list / stat 请求的 stable root identifier
2. `label`：用于 picker UI
3. `path`：root 的 canonical absolute path，方便 UI 展示 breadcrumb
4. `isDefault`：用于决定初始选中 root

### 9.2 `POST /v1/bootstrap/filesystem/list`

用途：

列出某个 allowed root 下的目录内容。

请求体：

```json
{
  "rootId": "workspace",
  "path": "harbor-assistant",
  "cursor": null,
  "limit": 200,
  "includeHidden": false,
  "directoriesOnly": true
}
```

字段说明：

1. `rootId`：必须命中服务端配置的 allowed root
2. `path`：相对于 root 的相对路径；为空或缺省表示 root 本身
3. `cursor`：分页 cursor，语义与现有 filesystem list 保持一致
4. `limit`：分页大小
5. `includeHidden`：是否包含 hidden entries
6. `directoriesOnly`：首版建议默认为 `true`，但保留显式字段，方便后续复用组件

成功响应：

```json
{
  "ok": true,
  "listing": {
    "rootId": "workspace",
    "rootPath": "/Users/qiuhao/workspace",
    "path": "harbor-assistant",
    "absolutePath": "/Users/qiuhao/workspace/harbor-assistant",
    "parentPath": "",
    "entries": [
      {
        "name": "apps",
        "path": "harbor-assistant/apps",
        "absolutePath": "/Users/qiuhao/workspace/harbor-assistant/apps",
        "type": "directory",
        "isHidden": false,
        "isSymlink": false,
        "size": null,
        "mtime": "2026-03-26T00:00:00.000Z"
      }
    ],
    "nextCursor": null,
    "truncated": false
  }
}
```

字段说明：

1. `rootPath`：root 的 canonical absolute path
2. `path`：当前 listing 对应的 root-relative path
3. `absolutePath`：当前 listing 节点的 absolute path
4. `parentPath`：当前节点的 parent relative path；位于 root 顶层时为 `null` 或空值，首版建议统一为 `null`
5. `entries[].path`：relative path
6. `entries[].absolutePath`：对应 absolute path，便于最终 create project 提交

### 9.3 `GET /v1/bootstrap/filesystem/stat`

用途：

对一个候选目录做最终确认，或者用于 picker 恢复已选目录状态。

查询参数：

```text
rootId=workspace&path=harbor-assistant
```

成功响应：

```json
{
  "ok": true,
  "pathInfo": {
    "rootId": "workspace",
    "rootPath": "/Users/qiuhao/workspace",
    "path": "harbor-assistant",
    "absolutePath": "/Users/qiuhao/workspace/harbor-assistant",
    "type": "directory",
    "isHidden": false,
    "isSymlink": false,
    "size": null,
    "mtime": "2026-03-26T00:00:00.000Z"
  }
}
```

首版要求：

1. 必须能区分 file / directory
2. 必须能拒绝越界路径
3. 必须能对不存在路径返回结构化错误

## 10. 类型建议

建议在 service 侧新增以下模型。

### 10.1 Config-level types

```ts
export type BootstrapFileSystemRoot = {
  id: string
  label: string
  path: string
  isDefault: boolean
}
```

### 10.2 Application input types

```ts
export type BootstrapListDirectoryInput = {
  rootId: string
  path?: string
  cursor?: string | null
  limit?: number
  includeHidden?: boolean
  directoriesOnly?: boolean
}

export type BootstrapStatPathInput = {
  rootId: string
  path?: string
}
```

### 10.3 Response models

```ts
export type BootstrapDirectoryEntry = {
  name: string
  path: string
  absolutePath: string
  type: "directory" | "file"
  isHidden: boolean
  isSymlink: boolean
  size: number | null
  mtime: string | null
}

export type BootstrapDirectoryListing = {
  rootId: string
  rootPath: string
  path: string | null
  absolutePath: string
  parentPath: string | null
  entries: BootstrapDirectoryEntry[]
  nextCursor: string | null
  truncated: boolean
}

export type BootstrapPathInfo = {
  rootId: string
  rootPath: string
  path: string | null
  absolutePath: string
  type: "directory" | "file"
  isHidden: boolean
  isSymlink: boolean
  size: number | null
  mtime: string | null
}
```

## 11. 错误模型

建议在现有 filesystem error 基础上，补充 bootstrap-specific root error：

1. `FILESYSTEM_ROOT_NOT_FOUND`
2. `FILESYSTEM_ROOT_NOT_ALLOWED`
3. `BOOTSTRAP_FILESYSTEM_DISABLED`

其余错误继续复用现有 filesystem error 语义：

1. `PATH_NOT_FOUND`
2. `NOT_A_DIRECTORY`
3. `PATH_OUTSIDE_ALLOWED_ROOT`
4. `PERMISSION_DENIED`
5. `INVALID_CURSOR`
6. `INVALID_INPUT`

建议 HTTP 映射：

1. `BOOTSTRAP_FILESYSTEM_DISABLED` -> `503`
2. `FILESYSTEM_ROOT_NOT_FOUND` -> `404`
3. `FILESYSTEM_ROOT_NOT_ALLOWED` -> `403`
4. `PATH_NOT_FOUND` -> `404`
5. `NOT_A_DIRECTORY` -> `400`
6. `PATH_OUTSIDE_ALLOWED_ROOT` -> `403`
7. `PERMISSION_DENIED` -> `403`
8. `INVALID_CURSOR` / `INVALID_INPUT` -> `400`

## 12. 模块落点建议

建议继续放在 `filesystem` context 内，但明确分为 bootstrap facade 与现有 project facade。

推荐文件布局：

```text
apps/service/src/modules/filesystem/
  application/
    list-bootstrap-directory.ts
    stat-bootstrap-path.ts
    bootstrap-root-registry.ts
  routes/
    bootstrap-filesystem.routes.test.ts
    index.ts
  schemas/
    filesystem.schema.ts
```

说明：

1. 不建议为了 bootstrap 单独新建一个全新 context
2. 也不建议把 bootstrap 逻辑塞进 `project` 模块
3. bootstrap route 只是 `filesystem` 的另一层 facade，和 project-scoped route 并列

## 13. 与现有接口的关系

### 13.1 不替代现有 `/v1/projects/:projectId/files/*`

现有 project-scoped filesystem API 继续保留，服务于项目创建后的文件访问。

### 13.2 不复活旧的 `/v1/fs/list`

这是本设计的硬约束。

如果前端目录选择器仍然存在对 `/v1/fs/list` 的调用，应该迁移到：

1. `GET /v1/bootstrap/filesystem/roots`
2. `POST /v1/bootstrap/filesystem/list`
3. `GET /v1/bootstrap/filesystem/stat`

## 14. 前端接入方式

建议前端流程：

1. 页面加载时请求 `GET /v1/bootstrap/filesystem/roots`
2. 以 `isDefault` root 作为初始 root
3. 点击目录时调用 `POST /v1/bootstrap/filesystem/list`
4. 确认目录前调用 `GET /v1/bootstrap/filesystem/stat`
5. 最终仍然调用现有 `POST /v1/projects`，只是 `rootPath` 改为选中的 `absolutePath`

这意味着 project create API 首版不需要修改。

## 15. 首版接受标准

当且仅当下面条件都满足时，首版可视为完成：

1. 用户无需手动粘贴绝对路径即可选择目录
2. service 不接受任意绝对路径遍历请求
3. 所有 browse 行为都被限制在 configured allowed roots 内
4. `/v1/projects` 现有 contract 不需要为了目录选择而改变
5. bootstrap API 与 project-scoped API 的职责边界仍然清晰

## 16. 后续增强项

以下能力可以后续再做，不应阻塞首版：

1. `inspect-project-root`
2. “已注册项目”预检查
3. Git repository 识别
4. `package.json` / language markers 识别
5. 多 root 最近使用记录

如果做增强，也应遵守一条边界：

```text
Bootstrap filesystem browse is still a constrained onboarding capability, not a general-purpose file manager.
```
