# Web Cloudflare Workers Deployment

- Status: `Reference`
- Last updated: `2026-04-01`
- Scope: `apps/web`

本文档说明如何将 `apps/web` 以手动方式部署到 Cloudflare Workers。

当前结论只有一个：

- 前端使用 `TanStack Start + Cloudflare Workers`
- 后端 `executor service` 保持独立部署
- 前端通过公开的 `VITE_EXECUTOR_API_BASE_URL` 直接访问 executor

这也是当前仓库成本最低、风险最小的上线方式。本文档暂时不覆盖 GitHub Actions 自动发布。

## 当前部署形态

`apps/web` 当前是一个 TanStack Start SSR 应用，不再是 Next.js 应用。

与 Cloudflare 相关的关键文件如下：

- `apps/web/vite.config.mts`
  - 已接入 `@cloudflare/vite-plugin`
- `apps/web/wrangler.jsonc`
  - Worker 名称、兼容日期、入口配置都在这里
- `apps/web/package.json`
  - 已提供 `build`、`preview`、`deploy`、`cf-typegen` 脚本

当前 `wrangler.jsonc` 的核心配置：

- `main: "@tanstack/react-start/server-entry"`
- `compatibility_flags: ["nodejs_compat"]`
- `compatibility_date: "2026-04-01"`

## 先决条件

发布前请确认以下条件成立：

1. 你已经有 Cloudflare 账号，并且目标账号有 Workers 发布权限。
2. 你已经在本机安装依赖，并能在仓库里执行 `pnpm --dir apps/web build`。
3. `executor service` 已经部署到一个可被公网访问的域名。
4. `executor service` 已正确配置 CORS，允许你的前端站点域名访问。

如果第 3 条和第 4 条不满足，前端页面虽然能部署成功，但会在浏览器里请求后端失败。

## 环境变量

当前前端直接从浏览器访问 executor，因此生产环境至少需要这个变量：

```bash
VITE_EXECUTOR_API_BASE_URL=https://executor.example.com
```

约束如下：

- 不能使用 `http://127.0.0.1:3400`
- 不能使用只能在内网访问的地址
- 不能放密钥，因为 `VITE_*` 会被注入到前端构建产物

推荐使用固定 API 域名，例如：

```bash
VITE_EXECUTOR_API_BASE_URL=https://api.harbor.example.com
```

## 首次登录 Cloudflare

在仓库根目录执行：

```bash
pnpm --dir apps/web exec wrangler login
```

如果你更习惯在 `apps/web` 目录操作，也可以执行：

```bash
pnpm exec wrangler login
```

登录完成后，Wrangler 会把认证信息写到本机用户目录。

## 本地发布前校验

发布前建议至少执行下面几项：

```bash
pnpm --dir apps/web lint
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
pnpm --dir apps/web preview
```

说明：

- `build` 会产出 `dist/client` 和 `dist/server`
- `preview` 用于本地检查静态资源和 SSR 是否正常
- 如果本地页面能打开，但数据加载失败，优先检查 `VITE_EXECUTOR_API_BASE_URL`

## 手动发布

最直接的发布方式如下：

```bash
VITE_EXECUTOR_API_BASE_URL=https://executor.example.com pnpm --dir apps/web run deploy
```

这里的 `deploy` 脚本等价于：

```bash
pnpm run build
wrangler deploy
```

也就是说，发布时会先构建，再把产物推送到 Cloudflare Workers。

## 推荐发布流程

建议按这个顺序进行：

1. 先确认 `executor service` 已在生产环境可访问。
2. 用真实生产域名填入 `VITE_EXECUTOR_API_BASE_URL`。
3. 执行手动部署命令。
4. 先访问 Cloudflare 分配的 `workers.dev` 域名。
5. 检查首页加载、项目列表、任务相关接口是否正常。
6. 确认无误后再绑定正式自定义域名。

这样可以把问题分成两类：

- Worker 部署问题
- 前端到 executor 的网络问题

排查会更直接。

## 自定义域名

如果你后续要绑定正式域名，建议：

- 前端站点使用单独域名，例如 `harbor.example.com`
- executor API 使用单独域名，例如 `api.harbor.example.com`

这样边界更清晰，CORS 和后续网关治理也更容易收敛。

## Cloudflare 资源绑定

当前前端没有依赖 Cloudflare 的 KV、R2、Queues 或 Durable Objects，所以 `wrangler.jsonc` 保持最小配置即可。

如果后续需要绑定 Cloudflare 资源，可以继续在 `apps/web/wrangler.jsonc` 中增加：

- `vars`
- `kv_namespaces`
- `r2_buckets`
- `queues`
- `durable_objects`

如果你开始在 server-side 代码里消费 bindings，记得生成类型：

```bash
pnpm --dir apps/web run cf-typegen
```

## 常见问题

### 1. 页面能打开，但接口全失败

优先检查三件事：

- `VITE_EXECUTOR_API_BASE_URL` 是否还是本地地址
- executor 是否真的对公网开放
- executor 的 CORS 是否允许前端域名

### 2. Cloudflare 发布成功，但页面白屏或 SSR 异常

优先检查：

- `pnpm --dir apps/web build` 本地是否已经通过
- 是否误改了 `apps/web/wrangler.jsonc` 的 `main`
- 是否移除了 `nodejs_compat`

当前这套应用依赖 TanStack Start 的 server entry，因此 `main` 必须保持为：

```json
"main": "@tanstack/react-start/server-entry"
```

### 3. 需要隐藏 executor 的真实地址

当前方案没有隐藏后端地址，因为浏览器直接访问 executor。

如果后面要隐藏后端地址，建议下一阶段再做：

- 在 Worker 内增加 server functions 或代理层
- 前端只访问同源路径
- 由 Worker 再转发到 executor

这会增加一点实现成本，但可以减少 CORS 暴露面，也能避免把后端地址直接放进前端构建产物。

## 当前建议

现阶段推荐坚持下面这套方案：

- `apps/web` 部署到 Cloudflare Workers
- `executor service` 独立部署
- 使用公开的 `VITE_EXECUTOR_API_BASE_URL`
- 先手动部署，不接 GitHub Actions 自动化

当这条链路稳定后，再考虑：

- 自定义域名
- Worker 代理层
- GitHub Actions 自动发布
