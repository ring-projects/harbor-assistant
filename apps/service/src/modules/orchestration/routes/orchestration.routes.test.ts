import Fastify from "fastify"
import { describe, expect, it, vi } from "vitest"

import errorHandlerPlugin from "../../../plugins/error-handler"
import { createTask } from "../../task/domain/task"
import { attachTaskRuntime } from "../../task/application/task-read-models"
import { InMemoryTaskRepository } from "../../task/infrastructure/in-memory-task-repository"
import { InMemoryOrchestrationRepository } from "../infrastructure/in-memory-orchestration-repository"
import { createOrchestration } from "../domain/orchestration"
import type { CreateBootstrapRecordInput } from "../application/orchestration-bootstrap-store"
import { registerOrchestrationModuleRoutes } from "."

async function createApp() {
  const repository = new InMemoryOrchestrationRepository([
    createOrchestration({
      id: "orch-1",
      projectId: "project-1",
      title: "Runtime cleanup",
    }),
  ])
  const projectRepository = {
    findById: vi.fn(async (id: string) =>
      id === "project-1"
        ? {
            id: "project-1",
            slug: "harbor-assistant",
            name: "Harbor Assistant",
            description: null,
            rootPath: "/tmp/harbor-assistant",
            normalizedPath: "/tmp/harbor-assistant",
            status: "active" as const,
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
            archivedAt: null,
            lastOpenedAt: null,
            settings: {
              retention: {
                logRetentionDays: 30,
                eventRetentionDays: 7,
              },
              skills: {
                harborSkillsEnabled: false,
                harborSkillProfile: "default",
              },
            },
          }
        : null,
    ),
  }
  const task = attachTaskRuntime(
    createTask({
      id: "task-1",
      projectId: "project-1",
      orchestrationId: "orch-1",
      prompt: "Investigate runtime drift",
      status: "running",
    }),
    {
      executor: "codex",
      model: "gpt-5.3-codex",
      executionMode: "safe",
      effort: "medium",
    },
  )
  const taskRepository = new InMemoryTaskRepository([task])
  const bootstrapStore = {
    create: vi.fn(
      async ({
        orchestration,
        task,
        projectPath,
        runtimeConfig,
      }: CreateBootstrapRecordInput) => {
        await repository.save(orchestration)
        await taskRepository.create({
          task,
          projectPath,
          runtimeConfig,
        })
      },
    ),
  }
  const projectTaskPort = {
    getProjectForTask: vi.fn(async (projectId: string) => ({
      projectId,
      rootPath: "/tmp/harbor-assistant",
    })),
  }
  const runtimePort = {
    startTaskExecution: vi.fn(async () => {}),
    resumeTaskExecution: vi.fn(async () => {}),
    cancelTaskExecution: vi.fn(async () => {}),
  }
  const notificationPublisher = {
    publish: vi.fn(async () => {}),
  }
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerOrchestrationModuleRoutes(instance, {
        repository,
        bootstrapStore,
        projectRepository,
        projectTaskPort,
        taskRepository,
        runtimePort,
        notificationPublisher,
      })
    },
    { prefix: "/v1" },
  )
  await app.ready()
  return app
}

describe("orchestration routes", () => {
  it("exposes orchestration creation, listing, detail, and task endpoints", async () => {
    const app = await createApp()

    const created = await app.inject({
      method: "POST",
      url: "/v1/orchestrations",
      payload: {
        projectId: "project-1",
        title: "Refactor runtime boundaries",
      },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      ok: true,
      orchestration: {
        projectId: "project-1",
        title: "Refactor runtime boundaries",
      },
    })

    const bootstrapped = await app.inject({
      method: "POST",
      url: "/v1/orchestrations/bootstrap",
      payload: {
        projectId: "project-1",
        orchestration: {
          title: "Bootstrap orchestration",
          description: "Create initial task together",
        },
        initialTask: {
          prompt: "Investigate runtime drift",
          executor: "codex",
          model: "gpt-5.3-codex",
          executionMode: "safe",
          effort: "medium",
        },
      },
    })
    expect(bootstrapped.statusCode).toBe(201)
    expect(bootstrapped.json()).toMatchObject({
      ok: true,
      orchestration: {
        projectId: "project-1",
        title: "Bootstrap orchestration",
      },
      task: {
        projectId: "project-1",
        prompt: "Investigate runtime drift",
      },
      bootstrap: {
        runtimeStarted: true,
        warning: null,
      },
    })

    const listed = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1/orchestrations",
    })
    expect(listed.statusCode).toBe(200)
    expect(listed.json().ok).toBe(true)
    expect(listed.json().orchestrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "orch-1",
        }),
        expect.objectContaining({
          title: "Refactor runtime boundaries",
        }),
      ]),
    )

    const detail = await app.inject({
      method: "GET",
      url: "/v1/orchestrations/orch-1",
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json()).toMatchObject({
      ok: true,
      orchestration: {
        id: "orch-1",
      },
    })

    const createdTask = await app.inject({
      method: "POST",
      url: "/v1/orchestrations/orch-1/tasks",
      payload: {
        prompt: "Investigate runtime drift",
        executor: "codex",
        model: "gpt-5.3-codex",
        executionMode: "safe",
        effort: "medium",
      },
    })
    expect(createdTask.statusCode).toBe(201)
    expect(createdTask.json()).toMatchObject({
      ok: true,
      task: {
        orchestrationId: "orch-1",
        projectId: "project-1",
      },
    })

    const listedTasks = await app.inject({
      method: "GET",
      url: "/v1/orchestrations/orch-1/tasks",
    })
    expect(listedTasks.statusCode).toBe(200)
    expect(listedTasks.json()).toMatchObject({
      ok: true,
      tasks: expect.arrayContaining([
        expect.objectContaining({
          id: "task-1",
          orchestrationId: "orch-1",
        }),
      ]),
    })

    await app.close()
  })
})
