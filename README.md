# Harbor Assistant

Harbor Assistant 是一个面向本地代码仓库的 AI 工作台。当前版本的产品核心不是“通用聊天”，而是围绕一个本地项目，发起任务、观察执行过程、管理任务记录，以及为项目配置运行策略。

当前仓库是一个 monorepo：

- `apps/web`：面向用户的 Web 工作台
- `apps/service`：独立后端服务，负责项目、任务、文件系统、Git 和实时事件流
- `docs`：产品、设计、接口与 TDD 文档

## 产品定位

当前版本聚焦在一个清晰的主流程：

1. 注册一个本地项目目录
2. 为项目设置默认执行器和执行模式
3. 基于 prompt 创建任务
4. 实时查看任务状态与事件流
5. 管理任务历史和项目设置

它更像一个“项目级 AI 执行工作台”，而不是一个带完整 IDE 能力的在线编辑器。

## 当前用户可见功能

### 1. 项目工作区

- 支持通过显式输入本地绝对路径创建项目
- 支持管理多个项目并在项目之间切换
- 支持查看和修改项目级设置
- 支持删除项目

项目创建现在是“显式路径注册”模式。

这意味着：

- 前端不会再浏览整个本机目录树
- 后端文件与 Git 操作都会严格限定在项目根目录内

### 2. 任务创建与执行

- 支持为当前项目创建任务
- 创建任务时可选择执行器
  - `codex`
  - `claude-code`
- 可选择执行模式
  - `safe`
  - `connected`
  - `full-access`
- 可选指定模型；如果不指定，则使用运行时默认模型

当前任务的核心输入是文本 prompt。

### 3. 任务工作台

- 支持按项目查看任务列表
- 支持查看任务状态
  - `queued`
  - `running`
  - `completed`
  - `failed`
  - `cancelled`
- 支持实时接收任务事件流
- 支持查看任务消息、命令、工具调用、文件变化等投影视图
- 支持在同一个 execution session 上继续恢复 terminal task
- service 重启后会把 orphaned `queued` / `running` task 收敛为 `failed`
- 若 execution 已记录可恢复 session，用户仍可在同一个 execution session 上继续 `resume`
- 支持归档任务
- 支持永久删除任务

当前任务会话面板的重点是“观察执行过程 + 在同一 execution 上继续恢复”。

### 4. 项目设置

当前项目设置页支持配置：

- 默认执行器
- 默认执行模式
- 最大并发任务数
- 日志保留天数
- 事件保留天数

这部分是当前产品里最接近“项目级运行策略”的入口。

## 当前明确不提供的能力

为了收敛产品边界，当前版本有意不提供下面这些能力：

- 不支持通过前端浏览全局目录后再选项目
- 不支持创建新的 follow-up child task / thread fork 模型
- 不支持任务中断 `break current turn`
- 不支持任务重试 `retry`
- 不支持图片附件或图片上下文上传
- 不提供完整的在线文件编辑器体验
- 不提供完整的 Git 图形化工作台作为主界面能力

说明：

- 后端已经具备部分 Git / filesystem API 能力，但当前主产品流仍然以“项目 + 任务”工作台为中心
- 如果某项能力没有进入 Web 主流程，就不应该在 README 中被描述为现成功能

## 运行方式

### 环境要求

- `Node >= 24.11.1`
- `pnpm >= 10.20.0`

如果你要真正执行任务，而不只是启动前后端界面，还需要本机已经准备好对应的执行环境，例如：

- `codex` CLI
- `claude-code` CLI
- 对应执行器所需的本地认证与配置

### 安装依赖

```bash
pnpm install
```

### 启动前后端

推荐直接从仓库根目录启动：

```bash
pnpm run dev:all
```

也可以分别启动：

```bash
pnpm run dev:service
pnpm run dev:web
```

默认访问地址：

- Web：`http://localhost:3000`
- Service：`http://127.0.0.1:3400`

## 前后端通信方式

当前前端不再通过 Next.js BFF 代理请求，而是直接连接 `apps/service`。

- HTTP：直接访问 service 的 `/v1/*`
- Realtime：通过 Socket.IO 订阅 `interaction:*` 事件流

前端通过 `NEXT_PUBLIC_EXECUTOR_API_BASE_URL` 指向 service。

本地默认值通常是：

```env
NEXT_PUBLIC_EXECUTOR_API_BASE_URL=http://127.0.0.1:3400
```

## 本地配置与数据

Harbor 的本地配置目录是：

```text
~/.harbor
```

默认会包含：

- `~/.harbor/app.yaml`
- `~/.harbor/data/`

当前 service 使用的 SQLite 数据库默认位于：

```text
~/.harbor/data/harbor.sqlite
```

service 启动时会自动检查数据库是否存在以及 schema 是否已经初始化；如果缺失，会自动执行一次 `prisma db push` 来完成初始化。

## 当前仓库的真实状态

如果你从“产品说明”角度理解这个仓库，可以把它理解成下面这件事：

- 这是一个已经收敛到 `project / task / interaction` 主线的本地 AI 工作台
- 当前最完整、最可信的产品路径是：
  - 创建项目
  - 进入项目
  - 创建任务
  - 实时观察执行
  - 管理任务与项目设置
- 其他能力即使后端已有基础模块，也还没有全部进入主产品界面

## 常用命令

```bash
pnpm changeset
pnpm run dev:all
pnpm run dev:web
pnpm run dev:service
pnpm run lint
pnpm run typecheck
pnpm run test:web
pnpm run db:generate
pnpm run db:studio
```

注意：

- 如果你需要直接同步当前 schema 到本地数据库，请在 service 工作区执行：

```bash
pnpm --dir apps/service db:push
```

- 根目录当前虽然保留了旧的 `db:migrate:*` 脚本入口，但当前真实数据库工作流已经切到 `service + prisma db push`

## 版本发布

当前仓库使用 lockstep 版本策略管理发布版本：

- `@harbor/service`
- `@harbor/web`
- `@harbor/harbor-events`

推荐流程：

1. 功能变更提交前执行 `pnpm changeset`
2. 合并到 `main` 后，由 GitHub Actions 自动创建或更新版本 PR
3. 合并版本 PR
4. 基于版本号创建 Git tag，例如 `v0.2.0`
5. tag 会触发 GitHub Release，以及 service Docker 镜像的版本化构建

## 延伸文档

- 产品与设计总览：[docs/README.md](./docs/README.md)
- Project 设计：[docs/project-context-design-2026-03-24.md](./docs/project-context-design-2026-03-24.md)
- Task 设计：[docs/task-context-design-2026-03-25.md](./docs/task-context-design-2026-03-25.md)
- 数据库设计：[docs/service-database-schema-design-2026-03-25.md](./docs/service-database-schema-design-2026-03-25.md)
- Project TDD 计划：[docs/tdd/project.md](./docs/tdd/project.md)
- Git TDD 计划：[docs/tdd/git.md](./docs/tdd/git.md)
- Filesystem TDD 计划：[docs/tdd/filesystem.md](./docs/tdd/filesystem.md)
- Interaction TDD 计划：[docs/tdd/interaction.md](./docs/tdd/interaction.md)
- Task TDD 计划：[docs/tdd/task.md](./docs/tdd/task.md)
