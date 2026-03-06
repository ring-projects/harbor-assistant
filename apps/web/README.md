# Harbor Web App

当前 Harbor 前端应用，基于 Next.js 16 + React 19。

## 开发

```bash
bun run dev
```

通常从仓库根目录启动：

```bash
bun run dev:web
```

如果需要同时启动前后端（推荐）：

```bash
bun run dev:all
```

## 连接后端 service

Web 侧 `/api/projects` 与 `/api/fs/list` 已改为转发到 service。

- 环境变量：`EXECUTOR_SERVICE_BASE_URL`
- 默认值：`http://127.0.0.1:3400`
