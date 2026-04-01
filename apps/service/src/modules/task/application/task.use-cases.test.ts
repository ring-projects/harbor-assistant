import { describe, expect, it, vi } from "vitest"

import type { AgentInput } from "../../../lib/agents"
import { createTask } from "../domain/task"
import { TASK_ERROR_CODES, type TaskError } from "../errors"
import { archiveTaskUseCase } from "./archive-task"
import { cancelTaskUseCase } from "./cancel-task"
import { createTaskUseCase } from "./create-task"
import { deleteTaskUseCase } from "./delete-task"
import { getTaskDetailUseCase } from "./get-task-detail"
import { getTaskEventsUseCase } from "./get-task-events"
import type { ProjectTaskPort } from "./project-task-port"
import { resumeTaskUseCase } from "./resume-task"
import type { TaskNotificationPublisher } from "./task-notification"
import type { TaskRecordStore } from "./task-record-store"
import type { TaskRepository } from "./task-repository"
import { attachTaskRuntime, type TaskRecord } from "./task-read-models"
import type { TaskRuntimePort } from "./task-runtime-port"
import { updateTaskTitleUseCase } from "./update-task-title"

describe("task use cases", () => {
  function createExplicitRuntimeConfig() {
    return {
      executor: "codex" as const,
      model: "gpt-5.3-codex" as const,
      executionMode: "safe" as const,
      effort: "medium" as const,
    }
  }

  function createTaskRecord(
    task = createTask({
      id: "task-1",
      projectId: "project-1",
      orchestrationId: "orch-1",
      prompt: "Investigate runtime drift",
      status: "completed",
    }),
    overrides: Partial<
      Pick<TaskRecord, "executor" | "model" | "executionMode" | "effort">
    > = {},
  ): TaskRecord {
    return attachTaskRuntime(task, {
      executor: "codex",
      model: null,
      executionMode: "safe",
      effort: null,
      ...overrides,
    })
  }

  function createRepository(
    seed = [createTaskRecord()],
  ): TaskRepository & TaskRecordStore {
    const tasks = new Map(seed.map((task) => [task.id, task]))
    return {
      create: vi.fn(async ({ task, runtimeConfig }) => {
        tasks.set(task.id, attachTaskRuntime(task, runtimeConfig))
      }),
      findById: vi.fn(async (id: string) => tasks.get(id) ?? null),
      listByProject: vi.fn(async ({ projectId, includeArchived, limit }) => {
        const items = [...tasks.values()]
          .filter((task) => task.projectId === projectId)
          .filter((task) => includeArchived || task.archivedAt === null)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())

        return limit === undefined ? items : items.slice(0, limit)
      }),
      listByOrchestration: vi.fn(async ({ orchestrationId, includeArchived, limit }) => {
        const items = [...tasks.values()]
          .filter((task) => task.orchestrationId === orchestrationId)
          .filter((task) => includeArchived || task.archivedAt === null)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())

        return limit === undefined ? items : items.slice(0, limit)
      }),
      save: vi.fn(async (task) => {
        const current = tasks.get(task.id)
        const runtime = task as Partial<TaskRecord>
        tasks.set(
          task.id,
          attachTaskRuntime(task, {
            executor: Object.prototype.hasOwnProperty.call(runtime, "executor")
              ? runtime.executor ?? "codex"
              : current?.executor ?? "codex",
            model: Object.prototype.hasOwnProperty.call(runtime, "model")
              ? runtime.model ?? null
              : current?.model ?? null,
            executionMode: Object.prototype.hasOwnProperty.call(runtime, "executionMode")
              ? runtime.executionMode ?? "safe"
              : current?.executionMode ?? "safe",
            effort: Object.prototype.hasOwnProperty.call(runtime, "effort")
              ? runtime.effort ?? null
              : current?.effort ?? null,
          }),
        )
      }),
      delete: vi.fn(async (taskId: string) => {
        tasks.delete(taskId)
      }),
    }
  }

  function createNotificationPublisher(): TaskNotificationPublisher {
    return {
      publish: vi.fn(),
    }
  }

  function createProjectTaskPort(): ProjectTaskPort {
    return {
      getProjectForTask: vi.fn(async () => ({
        projectId: "project-1",
        rootPath: "/tmp/harbor-assistant",
      })),
    }
  }

  function createRuntimePort(): TaskRuntimePort {
    return {
      startTaskExecution: vi.fn(async () => undefined),
      resumeTaskExecution: vi.fn(async () => undefined),
      cancelTaskExecution: vi.fn(async () => undefined),
    }
  }

  it("creates a task from explicit runtime config and starts runtime via port", async () => {
    const repository = createRepository([])
    const publisher = createNotificationPublisher()
    const projectTaskPort = createProjectTaskPort()
    const runtimePort = createRuntimePort()

    const task = await createTaskUseCase(
      {
        projectTaskPort,
        taskRecordStore: repository,
        repository,
        runtimePort,
        notificationPublisher: publisher,
        idGenerator: () => "task-created-1",
      },
      {
        projectId: "project-1",
        orchestrationId: "orch-1",
        prompt: "Investigate runtime drift",
        ...createExplicitRuntimeConfig(),
      },
    )

    expect(task).toMatchObject({
      id: "task-created-1",
      projectId: "project-1",
      orchestrationId: "orch-1",
      title: "Investigate runtime drift",
      executor: "codex",
      model: "gpt-5.3-codex",
      executionMode: "safe",
      effort: "medium",
      status: "queued",
    })
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPath: "/tmp/harbor-assistant",
        runtimeConfig: {
          executor: "codex",
          executionMode: "safe",
          model: "gpt-5.3-codex",
          effort: "medium",
        },
      }),
    )
    expect(runtimePort.startTaskExecution).toHaveBeenCalledWith({
      taskId: "task-created-1",
      projectId: "project-1",
      projectPath: "/tmp/harbor-assistant",
      input: "Investigate runtime drift",
      runtimeConfig: {
        executor: "codex",
        model: "gpt-5.3-codex",
        executionMode: "safe",
        effort: "medium",
      },
    })
    expect(publisher.publish).toHaveBeenCalledOnce()
  })

  it("creates a task from structured input while keeping prompt as summary", async () => {
    const repository = createRepository([])
    const publisher = createNotificationPublisher()
    const projectTaskPort = createProjectTaskPort()
    const runtimePort = createRuntimePort()

    const task = await createTaskUseCase(
      {
        projectTaskPort,
        taskRecordStore: repository,
        repository,
        runtimePort,
        notificationPublisher: publisher,
        idGenerator: () => "task-created-2",
      },
      {
        projectId: "project-1",
        orchestrationId: "orch-1",
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
        ...createExplicitRuntimeConfig(),
      },
    )

    expect(task.prompt).toBe("Review this screenshot")
    expect(task.executor).toBe("codex")
    expect(task.executionMode).toBe("safe")
    expect(runtimePort.startTaskExecution).toHaveBeenCalledWith({
      taskId: "task-created-2",
      projectId: "project-1",
      projectPath: "/tmp/harbor-assistant",
      input: [
        {
          type: "text",
          text: "Review this screenshot",
        },
        {
          type: "local_image",
          path: ".harbor/task-input-images/example.png",
        },
      ],
      runtimeConfig: {
        executor: "codex",
        model: "gpt-5.3-codex",
        executionMode: "safe",
        effort: "medium",
      },
    })
  })

  it("persists and forwards a supported effort", async () => {
    const repository = createRepository([])
    const publisher = createNotificationPublisher()
    const projectTaskPort = createProjectTaskPort()
    const runtimePort = createRuntimePort()

    const task = await createTaskUseCase(
      {
        projectTaskPort,
        taskRecordStore: repository,
        repository,
        runtimePort,
        notificationPublisher: publisher,
        idGenerator: () => "task-created-effort",
      },
      {
        projectId: "project-1",
        orchestrationId: "orch-1",
        prompt: "Investigate runtime drift",
        executor: "codex",
        model: "gpt-5.3-codex",
        executionMode: "safe",
        effort: "medium",
      },
    )

    expect(task.effort).toBe("medium")
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeConfig: expect.objectContaining({
          effort: "medium",
        }),
      }),
    )
    expect(runtimePort.startTaskExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeConfig: expect.objectContaining({
          effort: "medium",
        }),
      }),
    )
  })

  it("rejects unsupported effort and model combinations", async () => {
    const repository = createRepository([])
    const publisher = createNotificationPublisher()
    const projectTaskPort = createProjectTaskPort()
    const runtimePort = createRuntimePort()

    await expect(
      createTaskUseCase(
        {
          projectTaskPort,
          taskRecordStore: repository,
          repository,
          runtimePort,
          notificationPublisher: publisher,
        },
        {
          projectId: "project-1",
          orchestrationId: "orch-1",
          prompt: "Investigate runtime drift",
          executor: "codex",
          model: "gpt-5.1-codex-mini",
          executionMode: "safe",
          effort: "low",
        },
      ),
    ).rejects.toMatchObject({
      code: TASK_ERROR_CODES.INVALID_EFFORT,
    } satisfies Partial<TaskError>)
  })

  it("rejects unsupported models on create before runtime starts", async () => {
    const repository = createRepository([])
    const publisher = createNotificationPublisher()
    const projectTaskPort = createProjectTaskPort()
    const runtimePort = createRuntimePort()

    await expect(
      createTaskUseCase(
        {
          projectTaskPort,
          taskRecordStore: repository,
          repository,
          runtimePort,
          notificationPublisher: publisher,
        },
        {
          projectId: "project-1",
          orchestrationId: "orch-1",
          prompt: "Investigate runtime drift",
          executor: "codex",
          model: "missing-model",
          executionMode: "safe",
          effort: "medium",
        },
      ),
    ).rejects.toMatchObject({
      code: TASK_ERROR_CODES.INVALID_INPUT,
    } satisfies Partial<TaskError>)
  })

  it("requires a complete explicit runtime config on create", async () => {
    const repository = createRepository([])
    const publisher = createNotificationPublisher()
    const projectTaskPort = createProjectTaskPort()
    const runtimePort = createRuntimePort()

    await expect(
      createTaskUseCase(
        {
          projectTaskPort,
          taskRecordStore: repository,
          repository,
          runtimePort,
          notificationPublisher: publisher,
        },
        {
          projectId: "project-1",
          orchestrationId: "orch-1",
          prompt: "Investigate runtime drift",
          executor: "codex",
          model: "",
          executionMode: "safe",
          effort: "medium",
        },
      ),
    ).rejects.toMatchObject({
      code: TASK_ERROR_CODES.INVALID_INPUT,
    } satisfies Partial<TaskError>)

    expect(runtimePort.startTaskExecution).not.toHaveBeenCalled()
  })

  it("fails create when project does not exist", async () => {
    const repository = createRepository([])
    const publisher = createNotificationPublisher()
    const runtimePort = createRuntimePort()

    await expect(
      createTaskUseCase(
        {
          projectTaskPort: {
            getProjectForTask: vi.fn().mockResolvedValue(null),
          },
          taskRecordStore: repository,
          repository,
          runtimePort,
          notificationPublisher: publisher,
          idGenerator: () => "task-created-1",
        },
        {
          projectId: "missing",
          orchestrationId: "orch-1",
          prompt: "Investigate runtime drift",
          ...createExplicitRuntimeConfig(),
        },
      ),
    ).rejects.toMatchObject({
      code: TASK_ERROR_CODES.PROJECT_NOT_FOUND,
    } satisfies Partial<TaskError>)
  })

  it("gets task detail and fails for missing task", async () => {
    const repository = createRepository()

    const task = await getTaskDetailUseCase(repository, "task-1")
    expect(task.title).toBe("Investigate runtime drift")

    await expect(getTaskDetailUseCase(repository, "missing")).rejects.toMatchObject({
      code: TASK_ERROR_CODES.NOT_FOUND,
    } satisfies Partial<TaskError>)
  })

  it("archives and renames a task while publishing notifications", async () => {
    const repository = createRepository()
    const publisher = createNotificationPublisher()

    const archived = await archiveTaskUseCase(repository, publisher, "task-1")
    expect(archived.archivedAt).not.toBeNull()
    expect(repository.save).toHaveBeenCalledOnce()
    expect(publisher.publish).toHaveBeenCalledOnce()

    const renamed = await updateTaskTitleUseCase(repository, publisher, {
      taskId: "task-1",
      title: "Refine runtime drift report",
    })
    expect(renamed.title).toBe("Refine runtime drift report")
    expect(publisher.publish).toHaveBeenCalledTimes(2)
  })

  it("resumes a terminal task through the same execution boundary", async () => {
    const repository = createRepository([
      createTaskRecord(createTask({
        id: "task-1",
        projectId: "project-1",
        orchestrationId: "orch-1",
        prompt: "Investigate runtime drift",
        status: "completed",
      })),
    ])
    const resumeTaskExecution = vi.fn(async (input: {
      taskId: string
      projectId: string
      projectPath: string
      input: AgentInput
      runtimeConfig: {
        executor: string
        model: string | null
        executionMode: string | null
        effort: string | null
      }
    }) => {
      const current = await repository.findById(input.taskId)
      if (!current) {
        return
      }

      const nextTask: TaskRecord = {
        ...current,
        model: input.runtimeConfig.model,
        effort: input.runtimeConfig.effort as TaskRecord["effort"],
        status: "running",
        startedAt: new Date("2026-03-25T00:00:00.000Z"),
        finishedAt: null,
        updatedAt: new Date("2026-03-25T00:00:00.000Z"),
      }

      await repository.save(nextTask)
    })

    const task = await resumeTaskUseCase(
      {
        projectTaskPort: createProjectTaskPort(),
        repository,
        runtimePort: {
          ...createRuntimePort(),
          resumeTaskExecution,
        },
      },
      {
        taskId: "task-1",
        prompt: "Continue with the unresolved failures.",
      },
    )

    expect(resumeTaskExecution).toHaveBeenCalledWith({
      taskId: "task-1",
      projectId: "project-1",
      projectPath: "/tmp/harbor-assistant",
      input: "Continue with the unresolved failures.",
      runtimeConfig: {
        executor: "codex",
        model: null,
        executionMode: "safe",
        effort: null,
      },
    })
    expect(task.status).toBe("running")
  })

  it("resolves resume runtime overrides and updates the task snapshot", async () => {
    const repository = createRepository([
      createTaskRecord(
        createTask({
          id: "task-1",
          projectId: "project-1",
          orchestrationId: "orch-1",
          prompt: "Investigate runtime drift",
          status: "completed",
        }),
        {
          model: "gpt-5.3-codex",
          effort: "high",
        },
      ),
    ])
    const resumeTaskExecution = vi.fn(async (input: {
      taskId: string
      projectId: string
      projectPath: string
      input: AgentInput
      runtimeConfig: {
        executor: string
        model: string | null
        executionMode: string | null
        effort: string | null
      }
    }) => {
      const current = await repository.findById(input.taskId)
      if (!current) {
        return
      }

      const nextTask: TaskRecord = {
        ...current,
        model: input.runtimeConfig.model,
        effort: input.runtimeConfig.effort as TaskRecord["effort"],
        status: "running",
        startedAt: new Date("2026-03-25T00:00:00.000Z"),
        finishedAt: null,
        updatedAt: new Date("2026-03-25T00:00:00.000Z"),
      }

      await repository.save(nextTask)
    })

    const task = await resumeTaskUseCase(
      {
        projectTaskPort: createProjectTaskPort(),
        repository,
        runtimePort: {
          ...createRuntimePort(),
          resumeTaskExecution,
        },
      },
      {
        taskId: "task-1",
        prompt: "Continue with a cheaper model.",
        model: null,
        effort: null,
      },
    )

    expect(resumeTaskExecution).toHaveBeenCalledWith({
      taskId: "task-1",
      projectId: "project-1",
      projectPath: "/tmp/harbor-assistant",
      input: "Continue with a cheaper model.",
      runtimeConfig: {
        executor: "codex",
        model: null,
        executionMode: "safe",
        effort: null,
      },
    })
    expect(task.model).toBeNull()
    expect(task.effort).toBeNull()
  })

  it("resumes a terminal task with structured input without changing task prompt", async () => {
    const repository = createRepository([
      createTaskRecord(createTask({
        id: "task-1",
        projectId: "project-1",
        orchestrationId: "orch-1",
        prompt: "Original summary",
        status: "completed",
      })),
    ])
    const resumeTaskExecution = vi.fn(async () => undefined)

    const task = await resumeTaskUseCase(
      {
        projectTaskPort: createProjectTaskPort(),
        repository,
        runtimePort: {
          ...createRuntimePort(),
          resumeTaskExecution,
        },
      },
      {
        taskId: "task-1",
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
    )

    expect(resumeTaskExecution).toHaveBeenCalledWith({
      taskId: "task-1",
      projectId: "project-1",
      projectPath: "/tmp/harbor-assistant",
      input: [
        {
          type: "text",
          text: "Review this screenshot",
        },
        {
          type: "local_image",
          path: ".harbor/task-input-images/example.png",
        },
      ],
      runtimeConfig: {
        executor: "codex",
        model: null,
        executionMode: "safe",
        effort: null,
      },
    })
    expect(task.prompt).toBe("Original summary")
  })

  it("rejects invalid resume model overrides before the runtime call", async () => {
    const repository = createRepository([
      createTaskRecord(createTask({
        id: "task-1",
        projectId: "project-1",
        orchestrationId: "orch-1",
        prompt: "Investigate runtime drift",
        status: "completed",
      })),
    ])
    const runtimePort = createRuntimePort()

    await expect(
      resumeTaskUseCase(
        {
          projectTaskPort: createProjectTaskPort(),
          repository,
          runtimePort,
        },
        {
          taskId: "task-1",
          prompt: "Continue",
          model: "missing-model",
        },
      ),
    ).rejects.toMatchObject({
      code: TASK_ERROR_CODES.INVALID_INPUT,
    } satisfies Partial<TaskError>)

    expect(runtimePort.resumeTaskExecution).not.toHaveBeenCalled()
  })

  it("rejects resume for non-terminal tasks", async () => {
    const repository = createRepository([
      createTaskRecord(createTask({
        id: "task-running",
        projectId: "project-1",
        orchestrationId: "orch-1",
        prompt: "Still running",
        status: "running",
      })),
    ])

    await expect(
      resumeTaskUseCase(
        {
          projectTaskPort: createProjectTaskPort(),
          repository,
          runtimePort: createRuntimePort(),
        },
        {
          taskId: "task-running",
          prompt: "Continue",
        },
      ),
    ).rejects.toMatchObject({
      code: TASK_ERROR_CODES.INVALID_RESUME_STATE,
    } satisfies Partial<TaskError>)
  })

  it("cancels running tasks and returns the converged task detail", async () => {
    const repository = createRepository([
      createTaskRecord(createTask({
        id: "task-running",
        projectId: "project-1",
        orchestrationId: "orch-1",
        prompt: "Still running",
        status: "running",
      })),
    ])
    const runtimePort = createRuntimePort()

    vi.mocked(runtimePort.cancelTaskExecution).mockImplementation(async ({ taskId }) => {
      const current = await repository.findById(taskId)
      if (!current) {
        return
      }

      await repository.save({
        ...current,
        status: "cancelled",
        finishedAt: new Date("2026-03-29T00:00:00.000Z"),
        updatedAt: new Date("2026-03-29T00:00:00.000Z"),
      })
    })

    const result = await cancelTaskUseCase(
      {
        repository,
        runtimePort,
      },
      {
        taskId: "task-running",
      },
    )

    expect(runtimePort.cancelTaskExecution).toHaveBeenCalledWith({
      taskId: "task-running",
      reason: "User requested stop",
    })
    expect(result.status).toBe("cancelled")
  })

  it("treats terminal cancel as idempotent and rejects archived cancel", async () => {
    const runtimePort = createRuntimePort()

    const terminalRepository = createRepository([
      createTaskRecord(createTask({
        id: "task-cancelled",
        projectId: "project-1",
        orchestrationId: "orch-1",
        prompt: "Already cancelled",
        status: "cancelled",
      })),
    ])

    const result = await cancelTaskUseCase(
      {
        repository: terminalRepository,
        runtimePort,
      },
      {
        taskId: "task-cancelled",
      },
    )

    expect(result.status).toBe("cancelled")
    expect(runtimePort.cancelTaskExecution).not.toHaveBeenCalled()

    const archivedRepository = createRepository([
      createTaskRecord(createTask({
        id: "task-archived",
        projectId: "project-1",
        orchestrationId: "orch-1",
        prompt: "Archived run",
        status: "running",
        archivedAt: new Date("2026-03-29T00:00:00.000Z"),
      })),
    ])

    await expect(
      cancelTaskUseCase(
        {
          repository: archivedRepository,
          runtimePort,
        },
        {
          taskId: "task-archived",
        },
      ),
    ).rejects.toMatchObject({
      code: TASK_ERROR_CODES.INVALID_CANCEL_STATE,
    } satisfies Partial<TaskError>)
  })

  it("deletes only terminal tasks and returns delete result", async () => {
    const runningRepository = createRepository([
      createTaskRecord(createTask({
        id: "task-running",
        projectId: "project-1",
        orchestrationId: "orch-1",
        prompt: "First",
        status: "running",
      })),
    ])
    const publisher = createNotificationPublisher()

    await expect(
      deleteTaskUseCase(runningRepository, publisher, "task-running"),
    ).rejects.toMatchObject({
      code: TASK_ERROR_CODES.INVALID_DELETE_STATE,
    } satisfies Partial<TaskError>)

    const completedRepository = createRepository()
    const result = await deleteTaskUseCase(completedRepository, publisher, "task-1")
    expect(result).toEqual({
      taskId: "task-1",
      projectId: "project-1",
      orchestrationId: "orch-1",
    })
  })

  it("returns projected task events", async () => {
    const repository = createRepository()
    const projection = {
      getTaskEvents: vi.fn().mockResolvedValue({
        taskId: "task-1",
        items: [
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
        nextSequence: 2,
      }),
    }

    const result = await getTaskEventsUseCase(repository, projection, {
      taskId: "task-1",
      afterSequence: 0,
      limit: 50,
    })

    expect(result.isTerminal).toBe(true)
    expect(result.events.nextSequence).toBe(2)
    expect(projection.getTaskEvents).toHaveBeenCalledWith({
      taskId: "task-1",
      afterSequence: 0,
      limit: 50,
    })
  })
})
