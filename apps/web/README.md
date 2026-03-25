# Harbor Web App

当前 Harbor 前端应用，基于 Next.js 16 + React 19。

## 开发

```bash
pnpm run dev
```

通常从仓库根目录启动：

```bash
pnpm run dev:web
```

如果需要同时启动前后端（推荐）：

```bash
pnpm run dev:all
```

## 连接后端 service

Web 不再通过 Next.js BFF `/api/*` 转发请求，当前直接连接 executor service。

- 环境变量：`NEXT_PUBLIC_EXECUTOR_API_BASE_URL`
- 必填：没有默认推导逻辑
- 示例：`NEXT_PUBLIC_EXECUTOR_API_BASE_URL=http://127.0.0.1:3400`

当前 `project`、`task`、`git` 等前端数据请求都基于这个地址直接访问 `/v1/*`。
