# Project Dual Source Requirements

## Background

Harbor is moving from a local-directory-first product shape to a server-deployed service that should work for personal and small-team usage. The existing `project` model assumes every project is created from a server-accessible local directory. That assumption no longer holds for the primary onboarding flow.

We need to support two project source modes at the same time:

1. `rootPath`
   A project directly backed by a server-local directory.
2. `git`
   A project defined by a git repository reference, even when a local workspace has not been provisioned yet.

The goal of this change is to support both source types without breaking the current `rootPath` runtime flow.

## Product Requirements

### Create Project

The create project API and UI must accept either:

1. A local root path.
2. A git repository URL with an optional default branch.

The user must explicitly choose the source type at creation time.

### Read Project

Project read and list responses must expose:

1. The project profile fields: `id`, `name`, `slug`, `description`, `status`, timestamps, settings.
2. The project source descriptor.
3. The resolved local workspace fields when available.

### Update Project

This change only needs to support:

1. Updating project profile fields for all source types.
2. Updating `rootPath` only for `rootPath` projects.

Switching an existing project from `rootPath` to `git`, or from `git` to `rootPath`, is out of scope for this iteration.

### Runtime Behavior

`rootPath` projects continue to work exactly as before for filesystem, git, task, and orchestration flows.

`git` projects are allowed to exist without a local workspace. In that state:

1. Project creation, listing, reading, and profile updates work.
2. Filesystem and project git endpoints must fail with a structured project-state error instead of pretending that a local directory exists.
3. Task-creation and document flows that require a local workspace should treat the project as unavailable until a workspace resolver/provisioner is introduced.

## Domain Model

`Project` should have an explicit `source` union:

```ts
type ProjectSource =
  | {
      type: "rootPath"
      rootPath: string
      normalizedPath: string
    }
  | {
      type: "git"
      repositoryUrl: string
      branch: string | null
    }
```

The aggregate also keeps top-level `rootPath` and `normalizedPath` as nullable resolved workspace fields:

1. For `rootPath` projects, those fields mirror the source values.
2. For `git` projects, those fields are `null` until Harbor provisions a local workspace.

This keeps current runtime integrations stable while making the source model explicit.

## Persistence Requirements

The `projects` table must store:

1. `sourceType`
2. `sourceRepositoryUrl`
3. `sourceGitBranch`
4. Nullable `rootPath`
5. Nullable `normalizedPath`

`normalizedPath` remains unique only when present, so `git` projects can coexist without claiming a local path.

## API Shape

### Create

```json
{
  "id": "project-1",
  "name": "Harbor Assistant",
  "description": "Optional",
  "source": {
    "type": "git",
    "repositoryUrl": "https://github.com/acme/harbor-assistant.git",
    "branch": "main"
  }
}
```

or

```json
{
  "id": "project-1",
  "name": "Harbor Assistant",
  "source": {
    "type": "rootPath",
    "rootPath": "/srv/workspaces/harbor-assistant"
  }
}
```

### Read/List Response

Responses must include:

```json
{
  "project": {
    "id": "project-1",
    "name": "Harbor Assistant",
    "rootPath": null,
    "normalizedPath": null,
    "source": {
      "type": "git",
      "repositoryUrl": "https://github.com/acme/harbor-assistant.git",
      "branch": "main"
    }
  }
}
```

## Implementation Plan

### Step 1

Introduce the explicit source union in the project domain and API schema.

### Step 2

Update Prisma persistence and mappers to store and load both source types.

### Step 3

Keep the current `rootPath` runtime path intact by treating top-level `rootPath` and `normalizedPath` as resolved workspace fields.

### Step 4

Guard filesystem and project git routes so they fail clearly when the project does not currently have a local workspace.

### Step 5

Update the create-project UI to let the user choose between a local path and a git repository source.

## Out Of Scope

The following are not part of this iteration:

1. Automatic git clone or pull provisioning.
2. Background workspace reconciliation.
3. Switching an existing project between source types.
4. Branch-specific multi-workspace orchestration.
