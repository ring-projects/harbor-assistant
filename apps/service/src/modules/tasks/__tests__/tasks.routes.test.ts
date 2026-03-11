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
    await prisma.taskAgentEvent.deleteMany()
    await prisma.task.deleteMany()
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

  it("returns raw task agent events", async () => {
    const project = await prisma.project.create({
      data: {
        name: "Project One",
        slug: "project-one",
        rootPath: "/tmp/project-one",
        normalizedPath: "/tmp/project-one",
      },
    })

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        projectPath: "/tmp/project-one",
        prompt: "Run tests",
        executor: "codex",
        status: "completed",
      },
    })

    await prisma.taskAgentEvent.create({
      data: {
        taskId: task.id,
        sequence: 1,
        eventType: "command.started",
        payload: JSON.stringify({
          type: "command.started",
          commandId: "command-1",
          command: "bun test",
          timestamp: "2026-03-11T00:00:01.000Z",
        }),
      },
    })

    const response = await app.inject({
      method: "GET",
      url: `/v1/tasks/${task.id}/events`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      task: {
        id: task.id,
      },
      events: {
        taskId: task.id,
        nextSequence: 1,
        items: [
          {
            taskId: task.id,
            sequence: 1,
            eventType: "command.started",
            payload: {
              type: "command.started",
              command: "bun test",
            },
          },
        ],
      },
    })
  })

  it("breaks a running task turn", async () => {
    const project = await prisma.project.create({
      data: {
        name: "Project Two",
        slug: "project-two",
        rootPath: "/tmp/project-two",
        normalizedPath: "/tmp/project-two",
      },
    })

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        projectPath: "/tmp/project-two",
        prompt: "Run tests",
        executor: "codex",
        status: "running",
        threadId: "thread-1",
      },
    })

    const response = await app.inject({
      method: "POST",
      url: `/v1/tasks/${task.id}/break`,
      payload: {},
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      task: {
        id: task.id,
        status: "cancelled",
        error: "Current turn stopped by user request.",
      },
    })
  })
})
