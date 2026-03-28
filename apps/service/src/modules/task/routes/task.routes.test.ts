import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import Fastify from "fastify"
import { afterEach, describe, expect, it } from "vitest"

import { attachTaskRuntime, type TaskRecord } from "../application/task-read-models"
import { createTask } from "../domain/task"
import { InMemoryTaskEventProjection } from "../infrastructure/in-memory-task-event-projection"
import { InMemoryTaskRepository } from "../infrastructure/in-memory-task-repository"
import { createInMemoryTaskNotificationBus } from "../infrastructure/notification/in-memory-task-notification-bus"
import { registerTaskModuleRoutes } from "."
import errorHandlerPlugin from "../../../plugins/error-handler"

const tempRoots = new Set<string>()

function withRuntime(task: ReturnType<typeof createTask>): TaskRecord {
  return attachTaskRuntime(task, {
    executor: "codex",
    model: null,
    executionMode: "safe",
  })
}

async function createApp(
  rootPath = "/tmp/harbor-assistant",
  seedTasks: TaskRecord[] = [],
) {
  const repository = new InMemoryTaskRepository([
    withRuntime(createTask({
      id: "task-1",
      projectId: "project-1",
      prompt: "Investigate runtime drift",
      status: "completed",
    })),
    withRuntime(createTask({
      id: "task-2",
      projectId: "project-1",
      prompt: "Summarize runtime drift",
      status: "failed",
      archivedAt: new Date("2026-03-25T00:00:00.000Z"),
    })),
    ...seedTasks,
  ])
  const eventProjection = new InMemoryTaskEventProjection({
    "task-1": [
      {
        id: "event-1",
        taskId: "task-1",
        sequence: 1,
        eventType: "session.started",
        payload: {
          sessionId: "session-1",
        },
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
      },
    ],
  })
  const notificationBus = createInMemoryTaskNotificationBus()

  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerTaskModuleRoutes(instance, {
        repository,
        taskRecordStore: repository,
        eventProjection,
        notificationPublisher: notificationBus.publisher,
        projectTaskPort: {
          async getProjectForTask(projectId) {
            if (projectId !== "project-1") {
              return null
            }

              return {
              projectId,
              rootPath,
              settings: {
                defaultExecutor: "codex",
                defaultModel: null,
                defaultExecutionMode: "safe",
              },
            }
          },
        },
        runtimePort: {
          async startTaskExecution() {},
          async resumeTaskExecution(input) {
            const current = await repository.findById(input.taskId)
            if (!current) {
              return
            }

            await repository.save({
              ...current,
              status: "running",
              startedAt: new Date("2026-03-25T01:00:00.000Z"),
              finishedAt: null,
              updatedAt: new Date("2026-03-25T01:00:00.000Z"),
            })
          },
        },
      })
    },
    { prefix: "/v1" },
  )
  await app.ready()
  return app
}

describe("task routes", () => {
  afterEach(async () => {
    for (const rootPath of tempRoots) {
      await rm(rootPath, { recursive: true, force: true })
      tempRoots.delete(rootPath)
    }
  })

  it("creates a task", async () => {
    const app = await createApp()

    const created = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      payload: {
        projectId: "project-1",
        prompt: "Investigate runtime drift",
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      ok: true,
      task: {
        projectId: "project-1",
        prompt: "Investigate runtime drift",
        title: "Investigate runtime drift",
        executor: "codex",
        model: null,
        executionMode: "safe",
        status: "queued",
      },
    })
  })

  it("creates a task from structured input and keeps prompt as summary", async () => {
    const app = await createApp()

    const created = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      payload: {
        projectId: "project-1",
        items: [
          {
            type: "text",
            text: "Review this screenshot",
          },
          {
            type: "local_image",
            path: ".harbor/task-input-images/example.png",
          },
        ],
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      ok: true,
      task: {
        projectId: "project-1",
        prompt: "Review this screenshot",
        title: "Review this screenshot",
        executor: "codex",
        model: null,
        executionMode: "safe",
        status: "queued",
      },
    })
  })

  it("gets task detail and project task list", async () => {
    const app = await createApp()

    const detail = await app.inject({
      method: "GET",
      url: "/v1/tasks/task-1",
    })

    expect(detail.statusCode).toBe(200)
    expect(detail.json()).toMatchObject({
      ok: true,
      task: {
        id: "task-1",
        projectId: "project-1",
        title: "Investigate runtime drift",
        executor: "codex",
        model: null,
        executionMode: "safe",
        status: "completed",
      },
    })

    const list = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1/tasks",
    })

    expect(list.statusCode).toBe(200)
    expect(list.json()).toEqual({
      ok: true,
      tasks: [
        expect.objectContaining({
          id: "task-1",
          executor: "codex",
          model: null,
          executionMode: "safe",
        }),
      ],
    })
  })

  it("updates title, archives terminal task, and deletes terminal task", async () => {
    const app = await createApp()

    const renamed = await app.inject({
      method: "PUT",
      url: "/v1/tasks/task-1/title",
      payload: {
        title: "Refine runtime drift report",
      },
    })
    expect(renamed.statusCode).toBe(200)
    expect(renamed.json()).toMatchObject({
      ok: true,
      task: {
        id: "task-1",
        title: "Refine runtime drift report",
      },
    })

    const archived = await app.inject({
      method: "POST",
      url: "/v1/tasks/task-1/archive",
    })
    expect(archived.statusCode).toBe(200)
    expect(archived.json()).toMatchObject({
      ok: true,
      task: {
        id: "task-1",
        archivedAt: expect.any(String),
      },
    })

    const deleted = await app.inject({
      method: "DELETE",
      url: "/v1/tasks/task-1",
    })
    expect(deleted.statusCode).toBe(200)
    expect(deleted.json()).toEqual({
      ok: true,
      taskId: "task-1",
      projectId: "project-1",
    })
  })

  it("rejects deleting a running task", async () => {
    const app = await createApp(
      "/tmp/harbor-assistant",
      [
        withRuntime(createTask({
          id: "task-running",
          projectId: "project-1",
          prompt: "Still running",
          status: "running",
        })),
      ],
    )

    const deleted = await app.inject({
      method: "DELETE",
      url: "/v1/tasks/task-running",
    })

    expect(deleted.statusCode).toBe(409)
    expect(deleted.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_TASK_DELETE_STATE",
      },
    })
  })

  it("resumes a terminal task and rejects archived task resume", async () => {
    const app = await createApp()

    const resumed = await app.inject({
      method: "POST",
      url: "/v1/tasks/task-1/resume",
      payload: {
        prompt: "Continue from the previous execution context.",
      },
    })
    expect(resumed.statusCode).toBe(200)
    expect(resumed.json()).toMatchObject({
      ok: true,
      task: {
        id: "task-1",
        status: "running",
        finishedAt: null,
      },
    })

    const archivedResume = await app.inject({
      method: "POST",
      url: "/v1/tasks/task-2/resume",
      payload: {
        prompt: "Attempt to resume an archived task.",
      },
    })
    expect(archivedResume.statusCode).toBe(409)
  })

  it("resumes a terminal task from structured input", async () => {
    const app = await createApp()

    const resumed = await app.inject({
      method: "POST",
      url: "/v1/tasks/task-1/resume",
      payload: {
        items: [
          {
            type: "text",
            text: "Review this screenshot",
          },
          {
            type: "local_image",
            path: ".harbor/task-input-images/example.png",
          },
        ],
      },
    })

    expect(resumed.statusCode).toBe(200)
    expect(resumed.json()).toMatchObject({
      ok: true,
      task: {
        id: "task-1",
        status: "running",
        prompt: "Investigate runtime drift",
      },
    })
  })

  it("returns projected task events and structured errors", async () => {
    const app = await createApp()

    const events = await app.inject({
      method: "GET",
      url: "/v1/tasks/task-1/events?afterSequence=0&limit=50",
    })
    expect(events.statusCode).toBe(200)
    expect(events.json()).toMatchObject({
      ok: true,
      task: {
        id: "task-1",
      },
      events: {
        taskId: "task-1",
        nextSequence: 2,
        items: [
          expect.objectContaining({
            id: "event-1",
            sequence: 1,
            eventType: "session.started",
          }),
        ],
      },
    })

    const missing = await app.inject({
      method: "GET",
      url: "/v1/tasks/missing",
    })
    expect(missing.statusCode).toBe(404)
    expect(missing.json()).toMatchObject({
      ok: false,
      error: {
        code: "TASK_NOT_FOUND",
      },
    })

    const invalid = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      payload: {},
    })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST_BODY",
      },
    })

    const invalidTitle = await app.inject({
      method: "PUT",
      url: "/v1/tasks/task-1/title",
      payload: {},
    })
    expect(invalidTitle.statusCode).toBe(400)
    expect(invalidTitle.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST_BODY",
      },
    })
  })

  it("uploads a task input image into the project workspace", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "harbor-task-input-"))
    tempRoots.add(rootPath)
    const app = await createApp(rootPath)

    const uploaded = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/task-input-images",
      payload: {
        name: "screenshot.png",
        mediaType: "image/png",
        dataBase64: Buffer.from("test-image").toString("base64"),
      },
    })

    expect(uploaded.statusCode).toBe(200)
    expect(uploaded.json()).toMatchObject({
      ok: true,
      mediaType: "image/png",
      name: "screenshot.png",
      size: 10,
    })

    const body = uploaded.json() as {
      path: string
      mediaType: string
      name: string
      size: number
    }

    expect(body.path).toMatch(/^\.harbor\/task-input-images\/.+-screenshot\.png$/)
    const stored = await readFile(path.join(rootPath, body.path))
    expect(stored.toString()).toBe("test-image")
  })
})
