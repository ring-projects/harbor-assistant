import Fastify from "fastify"
import { describe, expect, it } from "vitest"

import { createTask } from "../domain/task"
import { InMemoryTaskEventProjection } from "../infrastructure/in-memory-task-event-projection"
import { InMemoryTaskRepository } from "../infrastructure/in-memory-task-repository"
import { createInMemoryTaskNotificationBus } from "../infrastructure/notification/in-memory-task-notification-bus"
import { registerTaskModuleRoutes } from "."
import errorHandlerPlugin from "../../../plugins/error-handler"

async function createApp() {
  const repository = new InMemoryTaskRepository([
    createTask({
      id: "task-1",
      projectId: "project-1",
      prompt: "Investigate runtime drift",
      status: "completed",
    }),
    createTask({
      id: "task-2",
      projectId: "project-1",
      prompt: "Summarize runtime drift",
      status: "failed",
      archivedAt: new Date("2026-03-25T00:00:00.000Z"),
    }),
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
              rootPath: "/tmp/harbor-assistant",
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
        },
      })
    },
    { prefix: "/v1" },
  )
  await app.ready()
  return app
}

describe("task routes", () => {
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
})
