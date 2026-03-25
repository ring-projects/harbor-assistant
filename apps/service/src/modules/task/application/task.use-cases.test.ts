import { describe, expect, it, vi } from "vitest"

import { createTask } from "../domain/task"
import { TASK_ERROR_CODES, type TaskError } from "../errors"
import { archiveTaskUseCase } from "./archive-task"
import { createTaskUseCase } from "./create-task"
import { deleteTaskUseCase } from "./delete-task"
import { getTaskDetailUseCase } from "./get-task-detail"
import { getTaskEventsUseCase } from "./get-task-events"
import type { ProjectTaskPort } from "./project-task-port"
import { listProjectTasksUseCase } from "./list-project-tasks"
import type { TaskNotificationPublisher } from "./task-notification"
import type { TaskRecordStore } from "./task-record-store"
import type { TaskRepository } from "./task-repository"
import type { TaskRuntimePort } from "./task-runtime-port"
import { updateTaskTitleUseCase } from "./update-task-title"

describe("task use cases", () => {
  function createRepository(seed = [createTask({
    id: "task-1",
    projectId: "project-1",
    prompt: "Investigate runtime drift",
    status: "completed",
  })]): TaskRepository & TaskRecordStore {
    const tasks = new Map(seed.map((task) => [task.id, task]))
    return {
      create: vi.fn(async ({ task }) => {
        tasks.set(task.id, task)
      }),
      findById: vi.fn(async (id: string) => tasks.get(id) ?? null),
      listByProject: vi.fn(async ({ projectId, includeArchived, limit }) => {
        const items = [...tasks.values()]
          .filter((task) => task.projectId === projectId)
          .filter((task) => includeArchived || task.archivedAt === null)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())

        return limit === undefined ? items : items.slice(0, limit)
      }),
      save: vi.fn(async (task) => {
        tasks.set(task.id, task)
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
        settings: {
          defaultExecutor: "codex",
          defaultModel: null,
          defaultExecutionMode: "safe",
        },
      })),
    }
  }

  function createRuntimePort(): TaskRuntimePort {
    return {
      startTaskExecution: vi.fn(async () => undefined),
    }
  }

  it("creates a task from project defaults and starts runtime via port", async () => {
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
        prompt: "Investigate runtime drift",
      },
    )

    expect(task).toMatchObject({
      id: "task-created-1",
      projectId: "project-1",
      title: "Investigate runtime drift",
      status: "queued",
    })
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPath: "/tmp/harbor-assistant",
        runtimeConfig: {
          executor: "codex",
          executionMode: "safe",
          model: null,
        },
      }),
    )
    expect(runtimePort.startTaskExecution).toHaveBeenCalledWith({
      taskId: "task-created-1",
      projectId: "project-1",
      projectPath: "/tmp/harbor-assistant",
      prompt: "Investigate runtime drift",
      runtimeConfig: {
        executor: "codex",
        model: null,
        executionMode: "safe",
      },
    })
    expect(publisher.publish).toHaveBeenCalledOnce()
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
          prompt: "Investigate runtime drift",
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

  it("lists project tasks with archived filtering", async () => {
    const repository = createRepository([
      createTask({
        id: "task-1",
        projectId: "project-1",
        prompt: "First",
        status: "completed",
      }),
      createTask({
        id: "task-2",
        projectId: "project-1",
        prompt: "Second",
        status: "failed",
        archivedAt: new Date("2026-03-25T00:00:00.000Z"),
      }),
    ])

    const activeOnly = await listProjectTasksUseCase(repository, {
      projectId: "project-1",
    })
    expect(activeOnly.map((task) => task.id)).toEqual(["task-1"])

    const withArchived = await listProjectTasksUseCase(repository, {
      projectId: "project-1",
      includeArchived: true,
    })
    expect(withArchived.map((task) => task.id)).toEqual(["task-1", "task-2"])
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

  it("deletes only terminal tasks and returns delete result", async () => {
    const runningRepository = createRepository([
      createTask({
        id: "task-running",
        projectId: "project-1",
        prompt: "First",
        status: "running",
      }),
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
