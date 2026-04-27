import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import {
  createDefaultAuthorizationService,
  createRepositoryAuthorizationOrchestrationQuery,
  createRepositoryAuthorizationProjectQuery,
  createRepositoryAuthorizationTaskQuery,
  createRepositoryAuthorizationWorkspaceQuery,
} from "../../authorization"
import errorHandlerPlugin from "../../../plugins/error-handler"
import { InMemoryOrchestrationRepository } from "../../orchestration/infrastructure/in-memory-orchestration-repository"
import { createProject } from "../../project/domain/project"
import { InMemoryProjectRepository } from "../../project/infrastructure/in-memory-project-repository"
import { InMemoryTaskRepository } from "../../task/infrastructure/in-memory-task-repository"
import { createWorkspace } from "../../workspace/domain/workspace"
import { InMemoryWorkspaceRepository } from "../../workspace/infrastructure/in-memory-workspace-repository"
import type { SandboxProvisioningPort } from "../application/sandbox-provider"
import { InMemorySandboxRegistry } from "../infrastructure/in-memory-sandbox-registry"
import { registerSandboxModuleRoutes } from "."

function createSandboxProviderStub() {
  let sandboxCounter = 0
  let commandCounter = 0
  let snapshotCounter = 0
  const handles = new Map<
    string,
    {
      providerCommandId: string
      logs(): AsyncIterable<string>
      wait(): Promise<{ exitCode: number | null }>
      kill(): Promise<void>
    }
  >()

  const provider: SandboxProvisioningPort & {
    createSandboxCalls: Array<
      Parameters<SandboxProvisioningPort["createSandbox"]>[0]
    >
  } = {
    provider: "docker",
    createSandboxCalls: [],
    async createSandbox(input) {
      sandboxCounter += 1
      provider.createSandboxCalls.push(input)
      return {
        providerSandboxId: `provider-sandbox-${sandboxCounter}`,
        workingDirectory:
          input.source.type === "directory"
            ? `/sandboxes/${sandboxCounter}`
            : input.source.type === "snapshot"
              ? `/sandboxes/snapshot-${sandboxCounter}`
              : `/sandboxes/git-${sandboxCounter}`,
        previewBaseUrl: null,
      }
    },
    async destroySandbox() {},
    async createSnapshot() {
      snapshotCounter += 1
      return {
        providerSnapshotId: `provider-snapshot-${snapshotCounter}`,
        providerSnapshotRef: `harbor/sandbox:snapshot_${snapshotCounter}`,
      }
    },
    async writeFiles() {},
    async readFile() {
      return new TextEncoder().encode("hello")
    },
    async runCommand(input) {
      commandCounter += 1
      const providerCommandId = `provider-command-${commandCounter}`
      handles.set(providerCommandId, {
        providerCommandId,
        async *logs() {
          yield "line 1"
        },
        async wait() {
          return {
            exitCode: 0,
          }
        },
        async kill() {},
      })

      return {
        providerCommandId,
        command: input.command,
        cwd: input.cwd?.trim() || "/sandboxes/1",
        detached: input.detached ?? false,
        startedAt: new Date("2026-04-20T00:00:00.000Z"),
      }
    },
    async getCommand(input) {
      return handles.get(input.providerCommandId) ?? null
    },
    async resolvePreviewUrl(input) {
      return `https://preview.example.com/${input.providerSandboxId}/${input.port}`
    },
  }

  return provider
}

async function createApp(args?: {
  projectRepository?: InMemoryProjectRepository
  workspaceRepository?: InMemoryWorkspaceRepository
  provider?: SandboxProvisioningPort & {
    createSandboxCalls: Array<
      Parameters<SandboxProvisioningPort["createSandbox"]>[0]
    >
  }
}) {
  const projectRepository =
    args?.projectRepository ?? new InMemoryProjectRepository()
  const workspaceRepository =
    args?.workspaceRepository ?? new InMemoryWorkspaceRepository()
  const provider = args?.provider ?? createSandboxProviderStub()
  const registry = new InMemorySandboxRegistry()
  const app = Fastify({ logger: false })
  const authorization = createDefaultAuthorizationService({
    workspaceQuery:
      createRepositoryAuthorizationWorkspaceQuery(workspaceRepository),
    projectQuery: createRepositoryAuthorizationProjectQuery(projectRepository),
    taskQuery: createRepositoryAuthorizationTaskQuery(
      new InMemoryTaskRepository(),
    ),
    orchestrationQuery: createRepositoryAuthorizationOrchestrationQuery(
      new InMemoryOrchestrationRepository(),
    ),
  })

  app.decorateRequest("auth", null)
  app.addHook("onRequest", async (request) => {
    const userId = String(request.headers["x-user-id"] ?? "user-1")
    const githubLogin = String(request.headers["x-user-login"] ?? userId)
    request.auth = {
      sessionId: "session-1",
      userId,
      user: {
        id: userId,
        githubLogin,
        name: "User One",
        email: `${githubLogin}@example.com`,
        avatarUrl: null,
        status: "active",
        lastLoginAt: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    }
  })
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerSandboxModuleRoutes(instance, {
        authorization,
        projectRepository,
        provider,
        registry,
      })
    },
    { prefix: "/v1" },
  )
  await app.ready()

  return {
    app,
    provider,
    registry,
  }
}

describe("sandbox routes", () => {
  it("provisions a project sandbox from the local project path", async () => {
    const projectRepository = new InMemoryProjectRepository()
    const workspaceRepository = new InMemoryWorkspaceRepository()
    await workspaceRepository.save(
      createWorkspace({
        id: "workspace-1",
        name: "Workspace One",
        type: "personal",
        createdByUserId: "user-1",
      }),
    )
    await projectRepository.save(
      createProject({
        id: "project-1",
        name: "Harbor",
        workspaceId: "workspace-1",
        source: {
          type: "rootPath",
          rootPath: "/workspace/harbor",
          normalizedPath: "/workspace/harbor",
        },
      }),
    )

    const { app, provider } = await createApp({
      projectRepository,
      workspaceRepository,
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/sandboxes",
      payload: {
        mode: "connected",
        purpose: "development",
        labels: {
          branch: "feature/sandbox",
        },
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      ok: true,
      sandbox: {
        provider: "docker",
        metadata: {
          projectId: "project-1",
          purpose: "development",
          labels: {
            branch: "feature/sandbox",
          },
        },
      },
    })
    const listed = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1/sandboxes",
    })

    expect(listed.statusCode).toBe(200)
    expect(listed.json()).toMatchObject({
      ok: true,
      sandboxes: [
        expect.objectContaining({
          metadata: expect.objectContaining({
            projectId: "project-1",
          }),
        }),
      ],
    })
    expect(provider.createSandboxCalls[0]?.source).toEqual({
      type: "directory",
      path: "/workspace/harbor",
    })
  })

  it("starts sandbox commands, tracks completion, and resolves previews", async () => {
    const projectRepository = new InMemoryProjectRepository()
    const workspaceRepository = new InMemoryWorkspaceRepository()
    await workspaceRepository.save(
      createWorkspace({
        id: "workspace-1",
        name: "Workspace One",
        type: "personal",
        createdByUserId: "user-1",
      }),
    )
    await projectRepository.save(
      createProject({
        id: "project-1",
        name: "Harbor",
        workspaceId: "workspace-1",
        source: {
          type: "rootPath",
          rootPath: "/workspace/harbor",
          normalizedPath: "/workspace/harbor",
        },
      }),
    )

    const { app, provider } = await createApp({
      projectRepository,
      workspaceRepository,
    })

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/sandboxes",
      payload: {},
    })
    expect(created.statusCode).toBe(201)
    const sandboxId = created.json().sandbox.id as string

    const started = await app.inject({
      method: "POST",
      url: `/v1/sandboxes/${sandboxId}/commands`,
      payload: {
        command: "pnpm test",
        cwd: "apps/service",
      },
    })

    expect(started.statusCode).toBe(201)
    expect(started.json()).toMatchObject({
      ok: true,
      command: {
        sandboxId,
        command: "pnpm test",
        status: "running",
      },
    })

    const commandId = started.json().command.id as string

    await expect
      .poll(async () => {
        const commandResponse = await app.inject({
          method: "GET",
          url: `/v1/sandboxes/${sandboxId}/commands/${commandId}`,
        })

        return commandResponse.json().command.status
      })
      .toBe("completed")

    const commands = await app.inject({
      method: "GET",
      url: `/v1/sandboxes/${sandboxId}/commands`,
    })

    expect(commands.statusCode).toBe(200)
    expect(commands.json()).toMatchObject({
      ok: true,
      commands: [
        expect.objectContaining({
          id: commandId,
          sandboxId,
          status: "completed",
        }),
      ],
    })

    const snapshot = await app.inject({
      method: "POST",
      url: `/v1/sandboxes/${sandboxId}/snapshots`,
    })

    expect(snapshot.statusCode).toBe(201)
    const snapshotId = snapshot.json().snapshot.id as string

    const snapshots = await app.inject({
      method: "GET",
      url: `/v1/sandboxes/${sandboxId}/snapshots`,
    })

    expect(snapshots.statusCode).toBe(200)
    expect(snapshots.json()).toMatchObject({
      ok: true,
      snapshots: [
        expect.objectContaining({
          id: snapshotId,
          sandboxId,
          providerSnapshotRef: "harbor/sandbox:snapshot_1",
        }),
      ],
    })

    const restored = await app.inject({
      method: "POST",
      url: `/v1/sandbox-snapshots/${snapshotId}/sandboxes`,
      payload: {
        mode: "safe",
        purpose: "task-prepare",
        labels: {
          restored: "true",
        },
      },
    })

    expect(restored.statusCode).toBe(201)
    expect(restored.json()).toMatchObject({
      ok: true,
      sandbox: {
        workingDirectory: "/sandboxes/snapshot-2",
        metadata: {
          projectId: "project-1",
          purpose: "task-prepare",
          labels: {
            restored: "true",
          },
        },
      },
    })
    expect(provider.createSandboxCalls[1]?.source).toEqual({
      type: "snapshot",
      snapshotId: "provider-snapshot-1",
    })

    const preview = await app.inject({
      method: "GET",
      url: `/v1/sandboxes/${sandboxId}/previews/3000`,
    })

    expect(preview.statusCode).toBe(200)
    expect(preview.json()).toEqual({
      ok: true,
      url: "https://preview.example.com/provider-sandbox-1/3000",
    })
  })

  it("falls back to the git source when a project has no local path", async () => {
    const projectRepository = new InMemoryProjectRepository()
    const workspaceRepository = new InMemoryWorkspaceRepository()
    const provider = createSandboxProviderStub()
    await workspaceRepository.save(
      createWorkspace({
        id: "workspace-1",
        name: "Workspace One",
        type: "personal",
        createdByUserId: "user-1",
      }),
    )
    await projectRepository.save(
      createProject({
        id: "project-1",
        name: "Harbor",
        workspaceId: "workspace-1",
        source: {
          type: "git",
          repositoryUrl: "https://github.com/acme/harbor.git",
          branch: "main",
        },
      }),
    )

    const { app } = await createApp({
      projectRepository,
      workspaceRepository,
      provider,
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/sandboxes",
      payload: {
        mode: "safe",
      },
    })

    expect(response.statusCode).toBe(201)
    expect(provider.createSandboxCalls[0]?.source).toEqual({
      type: "git",
      repositoryUrl: "https://github.com/acme/harbor.git",
      ref: "main",
    })
  })
})
