import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import type { FastifyInstance } from "fastify"
import type { PrismaClient } from "@prisma/client"

import { createProjectTestApp } from "../../../../test/helpers/project-test-app"
import { createTestDatabase, type TestDatabase } from "../../../../test/helpers/test-database"

async function createTempProjectDir() {
  return mkdtemp(path.join(tmpdir(), "harbor-project-route-test-"))
}

describe("project routes", () => {
  let database: TestDatabase
  let prisma: PrismaClient
  let app: FastifyInstance
  const tempProjectDirs: string[] = []

  beforeAll(async () => {
    database = await createTestDatabase()
    prisma = database.prisma
    app = await createProjectTestApp(prisma)
  })

  afterEach(async () => {
    await prisma.projectSetting.deleteMany()
    await prisma.project.deleteMany()

    await Promise.all(
      tempProjectDirs.splice(0, tempProjectDirs.length).map((dir) =>
        rm(dir, { recursive: true, force: true }),
      ),
    )
  })

  afterAll(async () => {
    await app.close()
    await database.cleanup()
  })

  it("lists projects with an empty result by default", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/projects",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      ok: true,
      projects: [],
    })
  })

  it("creates a project and returns the updated project list", async () => {
    const projectPath = await createTempProjectDir()
    const canonicalPath = await realpath(projectPath)
    tempProjectDirs.push(projectPath)

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        path: projectPath,
        name: "Example Project",
      },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json() as {
      ok: boolean
      projects: Array<{
        id: string
        name: string
        slug: string | null
        path: string
        normalizedPath: string
        status: string
      }>
    }

    expect(body.ok).toBe(true)
    expect(body.projects).toHaveLength(1)
    expect(body.projects[0]).toMatchObject({
      name: "Example Project",
      slug: "example-project",
      path: canonicalPath,
      normalizedPath: canonicalPath,
      status: "active",
    })
  })

  it("returns a conflict error when creating a duplicate project path", async () => {
    const projectPath = await createTempProjectDir()
    tempProjectDirs.push(projectPath)

    const firstResponse = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        path: projectPath,
        name: "First Project",
      },
    })

    expect(firstResponse.statusCode).toBe(200)

    const secondResponse = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        path: projectPath,
        name: "Second Project",
      },
    })

    expect(secondResponse.statusCode).toBe(409)
    expect(secondResponse.json()).toMatchObject({
      ok: false,
      error: {
        code: "DUPLICATE_PATH",
      },
    })
  })

  it("returns a validation error for an invalid create payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST_BODY",
      },
    })
  })

  it("returns persisted project settings", async () => {
    const projectPath = await createTempProjectDir()
    tempProjectDirs.push(projectPath)

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        path: projectPath,
        name: "Settings Project",
      },
    })

    expect(createResponse.statusCode).toBe(200)
    const body = createResponse.json() as {
      projects: Array<{ id: string }>
    }
    const projectId = body.projects[0]?.id

    const response = await app.inject({
      method: "GET",
      url: `/v1/projects/${projectId}/settings`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      settings: {
        projectId,
        defaultExecutor: "codex",
        defaultExecutionMode: "safe",
        maxConcurrentTasks: 1,
        logRetentionDays: 30,
        eventRetentionDays: 7,
      },
    })
  })

  it("updates project settings", async () => {
    const projectPath = await createTempProjectDir()
    tempProjectDirs.push(projectPath)

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        path: projectPath,
        name: "Settings Project",
      },
    })

    expect(createResponse.statusCode).toBe(200)
    const body = createResponse.json() as {
      projects: Array<{ id: string }>
    }
    const projectId = body.projects[0]?.id

    const response = await app.inject({
      method: "PUT",
      url: `/v1/projects/${projectId}/settings`,
      payload: {
        defaultExecutor: "claude-code",
        defaultModel: "claude-sonnet-4-5",
        defaultExecutionMode: "connected",
        maxConcurrentTasks: 2,
        logRetentionDays: null,
        eventRetentionDays: 14,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      settings: {
        projectId,
        defaultExecutor: "claude-code",
        defaultModel: "claude-sonnet-4-5",
        defaultExecutionMode: "connected",
        maxConcurrentTasks: 2,
        logRetentionDays: null,
        eventRetentionDays: 14,
      },
    })
  })

  it("returns not found when updating a missing project", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/v1/projects/project-missing",
      payload: {
        name: "Renamed Project",
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "PROJECT_NOT_FOUND",
      },
    })
  })

  it("returns not found when deleting a missing project", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: "/v1/projects/project-missing",
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "PROJECT_NOT_FOUND",
      },
    })
  })
})
