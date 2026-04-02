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
export DATABASE_URL=file:./dev.sqlite
pnpm --dir apps/service db:generate
pnpm --dir apps/service db:migrate:deploy
```

`DATABASE_URL` 现在是必填项。service 和 Prisma CLI 都直接从环境变量读取数据库连接串，不再回退到 `~/.harbor/app.yaml`。

项目级和运行级的非敏感配置放在 `apps/service/harbor.config.json`。如果部署时需要使用另一份配置文件，可以通过 `HARBOR_CONFIG_PATH` 指向它。

当前配置边界是：

- `env` 负责敏感或外部注入的配置：`DATABASE_URL`、GitHub OAuth / App 凭据、`NODE_ENV`
- `config` 负责项目级配置：host、port、路径、base URL、允许访问的 GitHub 用户和组织

对于本地 SQLite datasource，service 启动时还会自动检查数据库文件和 schema：

- 如果 sqlite 文件不存在，会自动执行一次 `prisma db push --skip-generate`
- 如果 sqlite 文件存在但 schema 尚未初始化，也会自动执行一次 `prisma db push --skip-generate`
- 如果你通过 `DATABASE_URL` 切到非 sqlite 数据源，service 不会自动迁移

当前默认配置示例：

```json
{
  "service": {
    "host": "127.0.0.1",
    "port": 3400,
    "name": "harbor"
  },
  "paths": {
    "runtimeRootDirectory": "./.harbor",
    "fileBrowserRootDirectory": "../.."
  },
  "urls": {
    "appBaseUrl": "http://127.0.0.1:3400",
    "webBaseUrl": "http://127.0.0.1:3000/app"
  },
  "auth": {
    "allowedGitHubUsers": [],
    "allowedGitHubOrgs": []
  }
}
```

如果你需要清空本地 SQLite 数据库并按最新 schema 重建：

1. 停掉当前 service 进程。
2. 删除 `DATABASE_URL` 指向的 sqlite 文件，以及可能存在的 `-wal` / `-shm` 文件。
3. 重新执行迁移：

```bash
export DATABASE_URL=file:./dev.sqlite
pnpm --dir apps/service db:migrate:dev
```

## 高级覆盖

运行时仍然会读取这些环境变量：

- `DATABASE_URL`
- `HARBOR_CONFIG_PATH`
- `NODE_ENV`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_WEBHOOK_SECRET`

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
  -e DATABASE_URL=file:/var/lib/harbor/harbor.sqlite \
  -v harbor-data:/var/lib/harbor \
  -v /absolute/path/to/workspace:/workspace \
  harbor-service
```

说明：

- 镜像默认使用 `HARBOR_CONFIG_PATH=/app/apps/service/harbor.docker.json`
- `harbor.docker.json` 默认把 runtime root 指向 `/var/lib/harbor`，把 workspace root 指向 `/workspace`
- `appBaseUrl` 现在是必填配置项；如果部署后的公开地址不是 `http://127.0.0.1:3400`，需要提供一份新的 JSON 配置文件并通过 `HARBOR_CONFIG_PATH` 挂载进去
- 如果需要在容器内真正执行任务，请确保运行环境中同时提供所需的 provider 认证信息
