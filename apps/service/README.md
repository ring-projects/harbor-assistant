# Harbor Service

`apps/service` 是 Harbor 的独立后端服务工作区，当前已初始化为 Fastify。

## 启动

```bash
bun run dev:service
```

或在工作区内：

```bash
bun run dev
```

从仓库根目录一条命令同时启动前后端：

```bash
bun run dev:all
```

## 健康检查

- `GET /healthz`

## Prisma 初始化

```bash
bun run db:generate
bun run db:migrate:deploy
```

默认 `DATABASE_URL` 使用：

- `file:$HOME/.harbor/data/tasks.sqlite`
