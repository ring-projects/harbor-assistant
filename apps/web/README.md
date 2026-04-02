# Harbor Web App

当前 Harbor 前端应用，基于 TanStack Start + React 19。

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

Web 直接连接 executor service，不经过框架层的 BFF `/api/*` 转发。

- 环境变量：`VITE_EXECUTOR_API_BASE_URL`
- 必填：没有默认推导逻辑
- 示例：`VITE_EXECUTOR_API_BASE_URL=http://127.0.0.1:3400`

当前 `project`、`task`、`git` 等前端数据请求都基于这个地址直接访问 `/v1/*`。

## Cloudflare Workers 部署

当前 `apps/web` 已经按 TanStack Start + Cloudflare Workers 的方式接好，可以直接部署到 Cloudflare。

推荐方案：

- Web 部署到 Cloudflare Workers
- `executor service` 继续独立部署
- 前端通过公开的 `VITE_EXECUTOR_API_BASE_URL` 直接访问后端

这样改动最小，也最符合当前应用结构。完整手动部署说明见：

- [../../docs/web-cloudflare-workers-deployment-2026-04-01.md](../../docs/web-cloudflare-workers-deployment-2026-04-01.md)

文档里包含：

- 手动部署步骤
- 环境变量配置
- CORS 要求
- `workers.dev` 验证顺序
- 常见故障排查
