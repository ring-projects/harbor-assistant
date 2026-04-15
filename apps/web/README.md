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

当前前端分两类请求：

- 业务数据请求仍然直接连接 executor service
- 认证请求通过 web 同源的 `/v1/auth/*` 代理转发到 executor service

- 环境变量：`VITE_EXECUTOR_API_BASE_URL`
- 必填：没有默认推导逻辑
- 示例：`VITE_EXECUTOR_API_BASE_URL=http://127.0.0.1:3400`

当前 `project`、`task`、`git` 等前端数据请求都基于这个地址直接访问 executor 的 `/v1/*`。

认证链路例外：

- 浏览器访问 web 同源的 `/v1/auth/session`
- 浏览器访问 web 同源的 `/v1/auth/github/start`
- web SSR / Worker 再把这些请求转发到 executor
- 这样 `harbor_session` cookie 会落在 web 域名上，便于 SSR 在路由加载阶段判断登录态

如果要让 GitHub OAuth callback 也走同源链路，service 的 `appBaseUrl` 需要配置成 web 对外暴露的域名，而不是 executor 自己的内网或直连域名。

## Cloudflare Workers 部署

当前 `apps/web` 已经按 TanStack Start + Cloudflare Workers 的方式接好，可以直接部署到 Cloudflare。

推荐方案：

- Web 部署到 Cloudflare Workers
- `executor service` 继续独立部署
- 前端业务请求通过公开的 `VITE_EXECUTOR_API_BASE_URL` 访问后端
- 认证请求通过 Worker 同源代理 `/v1/auth/*`

这样改动最小，也最符合当前应用结构。完整手动部署说明见：

- [../../docs/web-cloudflare-workers-deployment-2026-04-01.md](../../docs/web-cloudflare-workers-deployment-2026-04-01.md)

文档里包含：

- 手动部署步骤
- 环境变量配置
- CORS 要求
- `workers.dev` 验证顺序
- 常见故障排查
