import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import { registerProjectModuleRoutes } from "."
import { InMemoryProjectRepository } from "../infrastructure/in-memory-project-repository"
import { createSimpleProjectPathPolicy } from "../infrastructure/simple-project-path-policy"
import errorHandlerPlugin from "../../../plugins/error-handler"

async function createApp() {
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerProjectModuleRoutes(instance, {
        repository: new InMemoryProjectRepository(),
        pathPolicy: createSimpleProjectPathPolicy(),
      })
    },
    { prefix: "/v1" },
  )
  await app.ready()
  return app
}

describe("project routes", () => {
  it("lists projects and creates a new project", async () => {
    const app = await createApp()

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
        rootPath: "/tmp/harbor-assistant",
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
      },
    })
  })

  it("canonicalizes project root on create", async () => {
    const app = await createApp()

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "~/workspace/harbor-assistant",
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      ok: true,
      project: {
        normalizedPath: "/resolved/workspace/harbor-assistant",
        rootPath: "/resolved/workspace/harbor-assistant",
      },
    })
  })

  it("gets and updates project settings", async () => {
    const app = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "/tmp/harbor-assistant",
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
        execution: {
          defaultExecutor: null,
          defaultExecutionMode: null,
          maxConcurrentTasks: 1,
        },
      },
    })

    const updated = await app.inject({
      method: "PATCH",
      url: "/v1/projects/project-1/settings",
      payload: {
        execution: {
          maxConcurrentTasks: 4,
        },
      },
    })

    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toMatchObject({
      ok: true,
      project: {
        id: "project-1",
        settings: {
          execution: {
            maxConcurrentTasks: 4,
          },
        },
      },
    })
  })

  it("archives and restores a project", async () => {
    const app = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "/tmp/harbor-assistant",
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
    const app = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "/tmp/harbor-assistant",
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
    const app = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "/tmp/harbor-assistant",
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
    const app = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "/tmp/harbor-assistant",
      },
    })
    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-2",
        name: "Harbor Service",
        rootPath: "~/workspace/harbor-service",
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
    const app = await createApp()

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        rootPath: "/tmp/harbor-assistant",
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
    const app = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "/tmp/harbor-assistant",
      },
    })

    const response = await app.inject({
      method: "PATCH",
      url: "/v1/projects/project-1/settings",
      payload: {
        execution: {
          maxConcurrentTasks: 0,
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
    const app = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "/tmp/harbor-assistant",
      },
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-2",
        name: "Harbor Assistant 2",
        rootPath: "/tmp/harbor-assistant",
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
    const app = await createApp()

    await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        rootPath: "/tmp/harbor-assistant",
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
})
