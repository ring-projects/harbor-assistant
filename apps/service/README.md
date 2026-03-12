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

默认情况下，service 和 Prisma 命令都会从 `~/.harbor/app.yaml` 读取 Harbor 本地配置；首次启动时如果配置文件不存在，会自动创建默认配置。

当前默认配置示例：

```yaml
service:
  host: 127.0.0.1
  port: 3400
  name: harbor

fileBrowser:
  rootDirectory: "~"

project:
  dataFile: "data/projects.sqlite"

task:
  dataFile: "data/tasks.json"
  databaseFile: "data/tasks.sqlite"
```

实际 Prisma datasource 默认会解析为：

- `file:/Users/<your-user>/.harbor/data/tasks.sqlite`

如果你需要清空本地 SQLite 数据库并按最新 schema 重建：

1. 停掉当前 service 进程。
2. 查看 `~/.harbor/app.yaml` 中的 `task.databaseFile`。
3. 删除对应的 sqlite 文件，以及可能存在的 `-wal` / `-shm` 文件。
4. 重新执行迁移：

```bash
bun run --cwd apps/service db:migrate:dev
```

## 高级覆盖

如果你在调试、CI 或特殊部署环境中需要临时覆盖默认值，仍然可以使用环境变量：

- `DATABASE_URL`
- `FILE_BROWSER_ROOT_DIRECTORY`
- `HOST`
- `PORT`
- `SERVICE_NAME`
- `NODE_ENV`
- `HARBOR_HOME`
- `HARBOR_CONFIG_PATH`
