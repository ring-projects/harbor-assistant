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

这样改动最小，也最符合当前应用结构。后续如果你希望把后端地址隐藏起来，再把前端请求收口到 Worker 里的 server functions 或代理层。

### 1. 登录 Cloudflare

```bash
pnpm exec wrangler login
```

### 2. 配置生产环境变量

本地或 CI/CD 构建时，需要提供可公开访问的 executor 地址，例如：

```bash
VITE_EXECUTOR_API_BASE_URL=https://executor.example.com
```

注意：

- 这里不能再用 `http://127.0.0.1:3400`
- 如果浏览器继续直连 executor，executor 必须放开 Cloudflare 站点域名的 CORS
- `VITE_*` 变量会进入前端构建产物，只适合放公开配置，不适合放密钥

如果你使用 Wrangler 本地命令部署，可以直接在命令前注入：

```bash
VITE_EXECUTOR_API_BASE_URL=https://executor.example.com pnpm run deploy
```

如果你使用 GitHub Actions 或 Cloudflare 的构建流程，也需要在对应平台里配置同名环境变量。

### 3. 本地预览

```bash
pnpm run build
pnpm run preview
```

### 4. 发布

```bash
VITE_EXECUTOR_API_BASE_URL=https://executor.example.com pnpm run deploy
```

### 5. 生成 Cloudflare 类型

如果后面要在 server-side 代码里使用 Cloudflare bindings，可以生成类型：

```bash
pnpm run cf-typegen
```

### 推荐补充

- 先用 `workers.dev` 域名上线，确认 SSR、静态资源和 API 访问都正常，再绑定自定义域名
- 生产环境最好把 `executor` 放到固定域名，比如 `https://api.harbor.xxx`
- 如果后续要接入 KV、R2、Queues、Durable Objects，可以直接在 `wrangler.jsonc` 里继续加 bindings
