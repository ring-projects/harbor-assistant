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

当前部署约束分两类：

- 业务数据请求通过 `VITE_HARBOR_API_BASE_URL` 访问 executor 对外地址
- 认证请求必须以 web 对外域名提供同源的 `/v1/auth/*`

- 环境变量：`VITE_HARBOR_API_BASE_URL`
- 必填：没有默认推导逻辑
- 示例：`VITE_HARBOR_API_BASE_URL=http://localhost:3400`

当前 `project`、`task`、`git` 等前端数据请求仍然依赖这个变量指向的公开地址。

认证链路的部署要求：

- 浏览器应访问同源的 `/v1/auth/session`
- 浏览器应访问同源的 `/v1/auth/github/start`
- GitHub OAuth callback 应回到同源的 `/v1/auth/github/callback`
- `harbor_session` cookie 应写入 web 对外域名，便于 SSR 在路由加载阶段判断登录态

因此，service 的 `appBaseUrl` 需要配置成 web 对外暴露的正式域名，而不是 executor 自己的内网或直连域名。

当前 Cloudflare 对外 web 域名：

- `https://harbor.ring-project.app`

## Cloudflare Workers 部署

当前 `apps/web` 已经按 TanStack Start + Cloudflare Workers 的方式接好，可以直接部署到 Cloudflare。

推荐方案：

- Web 部署到 Cloudflare Workers
- `executor service` 继续独立部署
- 前端业务请求通过公开的 `VITE_HARBOR_API_BASE_URL` 访问后端
- 认证请求通过正式对外域名的同源 `/v1/auth/*`

当前 `apps/web/wrangler.jsonc` 已绑定：

- `harbor.ring-project.app/*`

这样改动最小，也最符合当前应用结构。完整手动部署说明见：

- [../../docs/web-cloudflare-workers-deployment-2026-04-01.md](../../docs/web-cloudflare-workers-deployment-2026-04-01.md)

文档里包含：

- 手动部署步骤
- 环境变量配置
- 同源认证要求
- 常见故障排查
