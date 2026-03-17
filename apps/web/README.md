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

Web 侧 `/api/projects` 与 `/api/fs/list` 已改为转发到 service。

- 环境变量：`EXECUTOR_SERVICE_BASE_URL`
- 默认值：`http://127.0.0.1:3400`
- 如果 service 运行在默认本地模式下，通常不需要额外配置。service 本身会从 `~/.harbor/app.yaml` 读取数据库和根目录设置。
