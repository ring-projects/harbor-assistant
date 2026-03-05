# Harbor Assistant Monorepo

Harbor Assistant 已切换为 Monorepo 结构，前后端代码分离：

- `apps/web`：Next.js 前端应用（当前主应用）
- `apps/service`：后端服务工程（独立进程入口）
- `scripts`：仓库级初始化脚本（如 Harbor 本地配置）
- `docs`：产品与架构文档

## 快速开始

```bash
bun install
bun run dev:web
```

默认会先执行 `init:harbor`，然后启动 `apps/web`。

## 常用命令

```bash
bun run dev:web
bun run dev:service
bun run typecheck
bun run lint
```

## 数据库（当前在 web 工作区）

```bash
bun run db:migrate:dev --name init_executor_tasks
bun run db:generate
```
