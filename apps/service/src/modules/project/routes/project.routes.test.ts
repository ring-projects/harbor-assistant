import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import { registerProjectModuleRoutes } from "."
import {
  createDefaultAuthorizationService,
  createRepositoryAuthorizationOrchestrationQuery,
  createRepositoryAuthorizationProjectQuery,
  createRepositoryAuthorizationTaskQuery,
  createRepositoryAuthorizationWorkspaceQuery,
} from "../../authorization"
import { InMemoryWorkspaceInstallationRepository } from "../../integration/github/infrastructure/in-memory-workspace-installation-repository"
import { InMemoryOrchestrationRepository } from "../../orchestration/infrastructure/in-memory-orchestration-repository"
import { createProject } from "../domain/project"
import { InMemoryProjectRepository } from "../infrastructure/in-memory-project-repository"
import { createSimpleProjectPathPolicy } from "../infrastructure/simple-project-path-policy"
import errorHandlerPlugin from "../../../plugins/error-handler"
import { InMemoryTaskRepository } from "../../task/infrastructure/in-memory-task-repository"
import { InMemoryWorkspaceRepository } from "../../workspace/infrastructure/in-memory-workspace-repository"
import { createWorkspace } from "../../workspace/domain/workspace"

async function createApp() {
  const app = Fastify({ logger: false })
  const projectRepository = new InMemoryProjectRepository()
  const workspaceRepository = new InMemoryWorkspaceRepository()
  const workspaceInstallationRepository =
    new InMemoryWorkspaceInstallationRepository()
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
      await registerProjectModuleRoutes(instance, {
        authorization,
        repository: projectRepository,
        workspaceRepository,
        workspaceInstallationRepository,
        pathPolicy: createSimpleProjectPathPolicy(),
      })
    },
    { prefix: "/v1" },
  )
  await app.ready()
  return {
    app,
    projectRepository,
    workspaceRepository,
  }
}

function rootPathSource(rootPath: string) {
  return {
    type: "rootPath" as const,
    rootPath,
  }
}

describe("project routes", () => {
  it("lists projects and creates a new rootPath project", async () => {
    const { app } = await createApp()

    const initial = await app.inject({
      method: "GET",
      url: "/v1/projects",
    })
    expect(initial.statusCode).toBe(200)
    expect(initial.json()).toEqual({
      ok: true,
      projects: [],
    })

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      ok: true,
      project: {
        id: "project-1",
        name: "Harbor Assistant",
        slug: "harbor-assistant",
        status: "active",
        source: {
          type: "rootPath",
          rootPath: "/tmp/harbor-assistant",
          normalizedPath: "/tmp/harbor-assistant",
        },
      },
    })
  })

  it("canonicalizes project root on create", async () => {
    const { app } = await createApp()

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("~/workspace/harbor-assistant"),
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      ok: true,
      project: {
        normalizedPath: "/resolved/workspace/harbor-assistant",
        rootPath: "/resolved/workspace/harbor-assistant",
        source: {
          type: "rootPath",
          rootPath: "/resolved/workspace/harbor-assistant",
          normalizedPath: "/resolved/workspace/harbor-assistant",
        },
      },
    })
  })

  it("creates a git-backed project without a local path", async () => {
    const { app } = await createApp()

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: {
          type: "git",
          repositoryUrl: "https://github.com/acme/harbor-assistant.git",
          branch: "main",
        },
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      ok: true,
      project: {
        id: "project-1",
        rootPath: null,
        normalizedPath: null,
        source: {
          type: "git",
          repositoryUrl: "https://github.com/acme/harbor-assistant.git",
          branch: "main",
        },
      },
    })
  })

  it("gets and updates project retention settings", async () => {
    const { app } = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    const settings = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1/settings",
    })
    expect(settings.statusCode).toBe(200)
    expect(settings.json()).toMatchObject({
      ok: true,
      settings: {
        retention: {
          logRetentionDays: 30,
          eventRetentionDays: 7,
        },
      },
    })
    expect(settings.json().settings).not.toHaveProperty("codex")

    const updated = await app.inject({
      method: "PATCH",
      url: "/v1/projects/project-1/settings",
      payload: {
        retention: {
          logRetentionDays: 14,
        },
      },
    })

    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toMatchObject({
      ok: true,
      project: {
        id: "project-1",
        settings: {
          retention: {
            logRetentionDays: 14,
          },
        },
      },
    })
    expect(updated.json().project.settings).not.toHaveProperty("codex")
  })

  it("archives and restores a project", async () => {
    const { app } = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    const archived = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/archive",
    })
    expect(archived.statusCode).toBe(200)
    expect(archived.json()).toMatchObject({
      ok: true,
      project: {
        id: "project-1",
        status: "archived",
      },
    })

    const restored = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/restore",
    })
    expect(restored.statusCode).toBe(200)
    expect(restored.json()).toMatchObject({
      ok: true,
      project: {
        id: "project-1",
        status: "active",
      },
    })
  })

  it("deletes a project", async () => {
    const { app } = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    const deleted = await app.inject({
      method: "DELETE",
      url: "/v1/projects/project-1",
    })

    expect(deleted.statusCode).toBe(200)
    expect(deleted.json()).toEqual({
      ok: true,
      projectId: "project-1",
    })

    const listed = await app.inject({
      method: "GET",
      url: "/v1/projects",
    })

    expect(listed.statusCode).toBe(200)
    expect(listed.json()).toEqual({
      ok: true,
      projects: [],
    })
  })

  it("updates project profile and relocates project root", async () => {
    const { app } = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    const updated = await app.inject({
      method: "PATCH",
      url: "/v1/projects/project-1",
      payload: {
        name: "Harbor Service",
        description: "Core service workspace",
        rootPath: "~/workspace/harbor-service",
      },
    })

    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toMatchObject({
      ok: true,
      project: {
        id: "project-1",
        name: "Harbor Service",
        slug: "harbor-service",
        description: "Core service workspace",
        normalizedPath: "/resolved/workspace/harbor-service",
      },
    })
  })

  it("does not partially persist profile changes when root relocation fails", async () => {
    const { app } = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })
    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-2",
        name: "Harbor Service",
        source: rootPathSource("~/workspace/harbor-service"),
      },
    })

    const response = await app.inject({
      method: "PATCH",
      url: "/v1/projects/project-1",
      payload: {
        name: "Renamed Harbor",
        rootPath: "~/workspace/harbor-service",
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "DUPLICATE_PATH",
      },
    })

    const project = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1",
    })

    expect(project.statusCode).toBe(200)
    expect(project.json()).toMatchObject({
      ok: true,
      project: {
        id: "project-1",
        name: "Harbor Assistant",
        slug: "harbor-assistant",
        normalizedPath: "/tmp/harbor-assistant",
      },
    })
  })

  it("rejects invalid create payloads at request validation", async () => {
    const { app } = await createApp()

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST_BODY",
      },
    })
  })

  it("rejects invalid settings payloads at request validation", async () => {
    const { app } = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    const response = await app.inject({
      method: "PATCH",
      url: "/v1/projects/project-1/settings",
      payload: {
        retention: {
          logRetentionDays: 0,
        },
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST_BODY",
      },
    })
  })

  it("returns duplicate-path conflict using structured project errors", async () => {
    const { app } = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-2",
        name: "Harbor Assistant 2",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "DUPLICATE_PATH",
      },
    })
  })

  it("returns invalid-state conflict using structured project errors", async () => {
    const { app } = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/archive",
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/archive",
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_PROJECT_STATE",
      },
    })
  })

  it("assigns a personal workspace automatically when creating a project", async () => {
    const { app } = await createApp()

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      ok: true,
      project: {
        id: "project-1",
        workspaceId: expect.any(String),
      },
    })
  })

  it("rejects creating a project inside a workspace the actor does not belong to", async () => {
    const { app, projectRepository, workspaceRepository } = await createApp()
    await workspaceRepository.save(
      createWorkspace({
        id: "ws-team",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
      }),
    )

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "user-2",
      },
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        workspaceId: "ws-team",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "PERMISSION_DENIED",
      },
    })
    await expect(projectRepository.list()).resolves.toEqual([])
  })

  it("rejects creating a project inside a shared workspace for non-owner members", async () => {
    const { app, projectRepository, workspaceRepository } = await createApp()
    const workspace = createWorkspace({
      id: "ws-team",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    await workspaceRepository.save({
      ...workspace,
      memberships: [
        ...workspace.memberships,
        {
          workspaceId: "ws-team",
          userId: "user-2",
          role: "member",
          status: "active",
          createdAt: new Date("2026-04-06T00:00:00.000Z"),
          updatedAt: new Date("2026-04-06T00:00:00.000Z"),
        },
      ],
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "user-2",
      },
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        workspaceId: "ws-team",
        source: rootPathSource("/tmp/harbor-assistant"),
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "PERMISSION_DENIED",
      },
    })
    await expect(projectRepository.list()).resolves.toEqual([])
  })

  it("hides a workspace project from non-members", async () => {
    const { app, projectRepository, workspaceRepository } = await createApp()
    const workspace = createWorkspace({
      id: "ws-team",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    await workspaceRepository.save(workspace)
    await projectRepository.save({
      ...createProject({
        id: "project-1",
        name: "Harbor Assistant",
        normalizedPath: "/tmp/harbor-assistant",
        ownerUserId: "user-1",
        workspaceId: "ws-team",
      }),
      workspaceId: "ws-team",
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "user-2",
      },
    })

    expect(response.statusCode).toBe(404)
  })

  it("rejects project settings updates by non-owner workspace members", async () => {
    const { app, projectRepository, workspaceRepository } = await createApp()
    const workspace = createWorkspace({
      id: "ws-team",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    await workspaceRepository.save({
      ...workspace,
      memberships: [
        ...workspace.memberships,
        {
          workspaceId: "ws-team",
          userId: "user-2",
          role: "member",
          status: "active",
          createdAt: new Date("2026-04-06T00:00:00.000Z"),
          updatedAt: new Date("2026-04-06T00:00:00.000Z"),
        },
      ],
    })
    await projectRepository.save({
      ...createProject({
        id: "project-1",
        name: "Harbor Assistant",
        normalizedPath: "/tmp/harbor-assistant",
        ownerUserId: "user-1",
        workspaceId: "ws-team",
      }),
      workspaceId: "ws-team",
    })

    const response = await app.inject({
      method: "PATCH",
      url: "/v1/projects/project-1/settings",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "user-2",
      },
      payload: {
        retention: {
          logRetentionDays: 14,
        },
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "PERMISSION_DENIED",
      },
    })
  })

  it("rejects project deletion by non-owner workspace members", async () => {
    const { app, projectRepository, workspaceRepository } = await createApp()
    const workspace = createWorkspace({
      id: "ws-team",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    await workspaceRepository.save({
      ...workspace,
      memberships: [
        ...workspace.memberships,
        {
          workspaceId: "ws-team",
          userId: "user-2",
          role: "member",
          status: "active",
          createdAt: new Date("2026-04-06T00:00:00.000Z"),
          updatedAt: new Date("2026-04-06T00:00:00.000Z"),
        },
      ],
    })
    await projectRepository.save({
      ...createProject({
        id: "project-1",
        name: "Harbor Assistant",
        normalizedPath: "/tmp/harbor-assistant",
        ownerUserId: "user-1",
        workspaceId: "ws-team",
      }),
      workspaceId: "ws-team",
    })

    const response = await app.inject({
      method: "DELETE",
      url: "/v1/projects/project-1",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "user-2",
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "PERMISSION_DENIED",
      },
    })
  })
})
