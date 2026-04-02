# Harbor Service

`apps/service` 是 Harbor 的独立后端服务工作区，当前已初始化为 Fastify。

## 启动

```bash
pnpm run dev:service
```

或在工作区内：

```bash
pnpm run dev
```

从仓库根目录一条命令同时启动前后端：

```bash
pnpm run dev:all
```

## 健康检查

- `GET /healthz`

## Prisma 初始化

```bash
pnpm --dir apps/service db:generate
pnpm --dir apps/service db:migrate:deploy
```

默认情况下，service 和 Prisma 命令都会从 `~/.harbor/app.yaml` 读取 Harbor 本地配置；首次启动时如果配置文件不存在，会自动创建默认配置。

对于本地 SQLite datasource，service 启动时还会自动检查数据库文件和 schema：

- 如果 sqlite 文件不存在，会自动执行一次 `prisma migrate deploy`
- 如果 sqlite 文件存在但 schema 尚未初始化，也会自动执行一次 `prisma migrate deploy`
- 如果你通过 `DATABASE_URL` 切到非 sqlite 数据源，service 不会自动迁移

当前默认配置示例：

```yaml
service:
  host: 127.0.0.1
  port: 3400
  name: harbor
  trustProxy: false

fileBrowser:
  rootDirectory: "~"

project:
  dataFile: "data/projects.sqlite"

task:
  dataFile: "data/tasks.json"
  databaseFile: "data/harbor.sqlite"
```

实际 Prisma datasource 默认会解析为：

- `file:/Users/<your-user>/.harbor/data/harbor.sqlite`

如果你需要清空本地 SQLite 数据库并按最新 schema 重建：

1. 停掉当前 service 进程。
2. 查看 `~/.harbor/app.yaml` 中的 `task.databaseFile`。
3. 删除对应的 sqlite 文件，以及可能存在的 `-wal` / `-shm` 文件。
4. 重新执行迁移：

```bash
pnpm --dir apps/service db:migrate:dev
```

## 高级覆盖

如果你在调试、CI 或特殊部署环境中需要临时覆盖默认值，仍然可以使用环境变量：

- `DATABASE_URL`
- `FILE_BROWSER_ROOT_DIRECTORY`
- `HOST`
- `PORT`
- `TRUST_PROXY`
- `SERVICE_NAME`
- `NODE_ENV`
- `APP_BASE_URL`
- `WEB_BASE_URL`
- `HARBOR_HOME`
- `HARBOR_CONFIG_PATH`

## Docker 运行

当前仓库提供了 `apps/service/Dockerfile`，用于构建一个可执行 Harbor service task 的运行镜像。
该镜像使用多阶段构建，最终 runtime 只保留生产依赖，不再携带 `tsx`、`typescript`、`vitest` 等开发依赖。

推荐从仓库根目录构建：

```bash
docker build -f apps/service/Dockerfile -t harbor-service .
```

最小运行示例：

```bash
docker run --rm \
  -p 3400:3400 \
  -e APP_BASE_URL=https://service.example.com \
  -e WEB_BASE_URL=https://app.example.com \
  -e TRUST_PROXY=true \
  -v harbor-data:/var/lib/harbor \
  -v /absolute/path/to/workspace:/workspace \
  harbor-service
```

说明：

- 镜像默认使用 `HARBOR_HOME=/var/lib/harbor`
- 镜像默认使用 `FILE_BROWSER_ROOT_DIRECTORY=/workspace`
- 如果需要在容器内真正执行任务，请确保运行环境中同时提供所需的 provider 认证信息
