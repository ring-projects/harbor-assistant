# Harbor Assistant

Harbor Assistant is an orchestration workspace for coding agents.

The current product is no longer best described as a tool for operating on a single local code repository. Harbor is now a server-deployed web app and backend service that lets a signed-in user manage projects, create orchestrations, run agent tasks, and attach those projects to either a server-local workspace or a Git-backed source such as GitHub.

## What Harbor Is

Harbor is built around four primary objects:

- `Project`: the top-level container a user owns
- `Project source`: how a project is defined
- `Orchestration`: the main work container inside a project
- `Task`: an executable, interactive unit of agent work inside an orchestration

The important change is that a project source and a local workspace are no longer the same thing.

- A project can be created from a server-local directory.
- A project can also be created from a git repository reference.
- A git-backed project may exist before Harbor provisions a local workspace for it.

That makes Harbor closer to an agent operations workspace than a local repository browser.

## Current Product Shape

The current implementation supports these flows:

- GitHub OAuth sign-in for Harbor user sessions
- Project creation from:
  - a server-local path
  - a GitHub repository selected through GitHub App installation access
  - a manual git repository URL
- Explicit project source modeling:
  - `rootPath`
  - `git`
- Git-backed projects that can remain `unprovisioned` until a local workspace is created
- Workspace provisioning and sync for GitHub-bound projects
- Project-scoped orchestration lists
- Orchestration bootstrap and task creation
- Task execution with supported agent runtimes such as `codex` and `claude-code`
- Runtime configuration per task, including executor, model, execution mode, and effort
- Real-time task event streaming and resumable terminal-style sessions

## What Harbor Is Not

To avoid the old mental model, it helps to be explicit about what Harbor is not:

- It is not just a UI for picking a local repository and chatting against it.
- It is not modeled around one repository path being the product's primary identity.
- It is not an in-browser IDE trying to replace a desktop editor.

Local workspaces still matter, but they are now execution infrastructure, not the entire product definition.

## Repository Layout

This repository is a monorepo:

- `apps/web`: authenticated web workspace
- `apps/service`: Fastify service, task runtime integration, Prisma persistence, realtime APIs
- `packages/harbor-events`: shared event contracts
- `docs`: product, architecture, API, and design notes

## Quick Start

### Requirements

- `Node >= 24.11.1`
- `pnpm >= 10.20.0`

If you want Harbor to actually run coding tasks, you also need the corresponding agent runtime and credentials available on the machine that runs `apps/service`.

### Install

```bash
pnpm install
```

### Required local environment

The service requires a database URL. For local development, SQLite is the simplest option:

```bash
export DATABASE_URL=file:./apps/service/dev.sqlite
```

The web app must know how to reach the service:

```bash
export VITE_EXECUTOR_API_BASE_URL=http://localhost:3400
```

### Start both apps

```bash
pnpm run dev:all
```

Or run them separately:

```bash
pnpm run dev:service
pnpm run dev:web
```

Default local endpoints:

- Web: `http://localhost:5173`
- Service: `http://localhost:3400`

## Configuration Notes

`apps/service` reads:

- `DATABASE_URL` for the database connection
- `apps/service/harbor.config.json` for non-secret default service settings
- environment variables only for externally injected or sensitive settings

Key service settings include:

- runtime root
- workspace root
- file browser root
- service/web base URLs
- listen address

For local SQLite, the service will initialize schema state on startup when needed by running `prisma db push --skip-generate`.

## GitHub Login And Repository Access

Harbor separates identity from repository access:

- GitHub OAuth is used for signing users into Harbor.
- GitHub App installation access is used for repository access.

To enable those flows, configure the service with the relevant GitHub settings:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_WEBHOOK_SECRET` if you later use webhook-driven flows

Optional allow-lists:

- `auth.allowedGitHubUsers`
- `auth.allowedGitHubOrgs` in `apps/service/harbor.config.json`

Without those GitHub settings, Harbor can still run locally, but GitHub sign-in and GitHub repository onboarding will not be available.

## Runtime Model

The main runtime path is:

1. Create or select a project.
2. Create or bootstrap an orchestration inside that project.
3. Start a task under that orchestration with an explicit runtime config.
4. Stream task events in real time.
5. Resume the same task session when the underlying runtime supports it.

This is why the README should no longer describe Harbor as a local-repository-first tool. The durable user-facing object is now the orchestration workspace, not a filesystem path.

## Common Commands

```bash
pnpm run dev:all
pnpm run dev:web
pnpm run dev:service
pnpm run lint
pnpm run typecheck
pnpm run test:web
pnpm run db:generate
pnpm run db:studio
pnpm changeset
```

If you need to push the current Prisma schema into the local database directly:

```bash
pnpm --dir apps/service db:push
```

## Release Workflow

This repository uses a lockstep versioning flow for:

- `@harbor/service`
- `@harbor/web`
- `@harbor/harbor-events`

Typical flow:

1. Run `pnpm changeset` before merging a change that affects a published package.
2. Merge to `main`.
3. Let GitHub Actions open or update the version PR.
4. Merge the version PR.
5. Tag the release, for example `v0.2.0`.

## Further Reading

- [docs/README.md](./docs/README.md)
- [docs/orchestration-requirements-2026-03-31.md](./docs/orchestration-requirements-2026-03-31.md)
- [docs/project-dual-source-requirements-2026-04-02.md](./docs/project-dual-source-requirements-2026-04-02.md)
- [docs/github-app-repository-access-design-2026-04-02.md](./docs/github-app-repository-access-design-2026-04-02.md)
- [docs/task-api.md](./docs/task-api.md)
- [docs/project-api.md](./docs/project-api.md)
