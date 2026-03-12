# Harbor Assistant

Harbor Assistant is a local-first AI coding workspace. The current product is centered around the `Codex` executor and includes a Web UI plus a standalone backend service for managing projects, submitting tasks, streaming task output, and connecting local working directories into the execution flow.

This repository uses a monorepo structure:

- `apps/web`: Next.js frontend application and current main entry point
- `apps/service`: Fastify backend service for projects, tasks, filesystem access, and executor capability detection
- `scripts`: repository-level initialization scripts, including creation of the local `~/.harbor` config directory
- `docs`: product, architecture, and research documents

## Required Environment

The current development setup requires:

- `Bun >= 1.3.5`
- `codex` CLI installed and available on your shell path
- Codex authentication and local configuration already set up on your machine

Important notes:

- Harbor does not log users in automatically or provision tokens for them
- Codex authentication, default model selection, MCP configuration, and related settings still depend on the user's local Codex environment
- In practice, this usually means `~/.codex` must already be configured, including token auth, `config.toml`, model settings, and similar local setup

If you only want to boot the frontend and backend locally, missing Codex authentication usually will not block the Web or service processes from starting. It will, however, affect actual task execution, model capability detection, and Codex runtime behavior.

## Getting Started

Install dependencies first:

```bash
bun install
```

The recommended way to start the app is:

```bash
bun run dev:all
```

This command first runs `init:harbor`, which creates local Harbor configuration:

- `~/.harbor/app.yaml`
- `~/.harbor/data`

It then starts both apps in parallel:

- Web: `http://localhost:3000`
- Service: `http://127.0.0.1:3400`

If you want to run them separately:

```bash
# terminal 1
bun run dev:service

# terminal 2
bun run dev:web
```

## Local Configuration

### Harbor App Configuration

Harbor now uses `~/.harbor/app.yaml` as the primary local configuration source. The file is created automatically by `bun run init:harbor`, and service startup will also auto-create it if missing.

Default config:

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

In normal local usage, you should not need to create `apps/service/.env` or manually configure `DATABASE_URL`.

Advanced overrides are still available through environment variables:

- `DATABASE_URL`
- `FILE_BROWSER_ROOT_DIRECTORY`
- `HOST`
- `PORT`
- `SERVICE_NAME`
- `NODE_ENV`
- `HARBOR_HOME`
- `HARBOR_CONFIG_PATH`

### Web Environment Variables

The frontend connects to the backend through `EXECUTOR_SERVICE_BASE_URL`. The default value is:

```text
http://127.0.0.1:3400
```

If your service runs on a different address, override it in `apps/web/.env.local`:

```env
EXECUTOR_SERVICE_BASE_URL=http://127.0.0.1:3400
```

## Common Commands

```bash
bun run dev:all
bun run dev:web
bun run dev:service
bun run typecheck
bun run lint
bun run build:web
bun run start:web
```

## Database

The current Prisma schema lives in `apps/service`. Common commands:

```bash
bun run db:generate
bun run db:migrate:dev
bun run db:migrate:deploy
```
