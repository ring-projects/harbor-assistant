# Harbor Assistant Monorepo

Harbor Assistant 已切换为 Monorepo 结构，前后端代码分离：

- `apps/web`：Next.js 前端应用（当前主应用）
- `apps/service`：后端服务工程（Fastify，独立进程入口）
- `scripts`：仓库级初始化脚本（如 Harbor 本地配置）
- `docs`：产品与架构文档

## 快速开始

```bash
bun install
bun run dev:all
```

`dev:all` 会先执行 `init:harbor`，再并行启动：

- `apps/web`（Next.js 前端）
- `apps/service`（Fastify 后端）

## 分别启动前后端

```bash
# 终端 1：后端
bun run dev:service

# 终端 2：前端
bun run dev:web
```

说明：

- `dev:web` 默认会先执行 `init:harbor`
- 前端通过 `EXECUTOR_SERVICE_BASE_URL` 连接后端（默认 `http://127.0.0.1:3400`）

## 常用命令

```bash
bun run dev:all
bun run dev:web
bun run dev:service
bun run typecheck
bun run lint
```

## 数据库（当前在 service 工作区）

```bash
bun run db:migrate:dev --name init_executor_tasks
bun run db:generate
```
