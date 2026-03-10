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
bun run --cwd apps/service db:generate
bun run --cwd apps/service db:migrate:deploy
```

`DATABASE_URL` 由 `apps/service/.env` 提供，Prisma schema 会直接读取该环境变量。

当前默认配置示例：

- `file:/Users/<your-user>/.harbor/data/harbor.sqlite`

如果你需要清空本地 SQLite 数据库并按最新 schema 重建：

1. 停掉当前 service 进程。
2. 查看 `apps/service/.env` 中的 `DATABASE_URL`。
3. 删除对应的 sqlite 文件，以及可能存在的 `-wal` / `-shm` 文件。
4. 重新执行迁移：

```bash
bun run --cwd apps/service db:migrate:dev
```
