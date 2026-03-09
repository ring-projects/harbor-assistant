import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import type { FastifyInstance } from "fastify"
import type { PrismaClient } from "@prisma/client"

import { createTaskTestApp } from "../../../../test/helpers/task-test-app"
import { createTestDatabase, type TestDatabase } from "../../../../test/helpers/test-database"

describe("task routes", () => {
  let database: TestDatabase
  let prisma: PrismaClient
  let app: FastifyInstance

  beforeAll(async () => {
    database = await createTestDatabase()
    prisma = database.prisma
    app = await createTaskTestApp(prisma)
  })

  afterEach(async () => {
    await prisma.taskEvent.deleteMany()
    await prisma.taskRun.deleteMany()
    await prisma.taskMessage.deleteMany()
    await prisma.task.deleteMany()
    await prisma.taskThread.deleteMany()
    await prisma.projectSetting.deleteMany()
    await prisma.project.deleteMany()
  })

  afterAll(async () => {
    await app.close()
    await database.cleanup()
  })

  it("returns a validation error for an invalid create task payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
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

  it("returns not found when creating a task for a missing project", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      payload: {
        projectId: "project-missing",
        prompt: "Run a task",
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

  it("returns not found for a missing task detail", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/tasks/task-missing",
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "TASK_NOT_FOUND",
      },
    })
  })
})
