import { describe, expect, it, vi } from "vitest"

import { createTaskError, type TaskError } from "../errors"
import { createTaskService } from "./task.service"
import { buildTask } from "./task-test-helpers"

describe("task archive/delete", () => {
  it("rejects archiving a running task", async () => {
    const runningTask = buildTask({
      status: "running",
      finishedAt: null,
    })

    const taskService = createTaskService({
      projectRepository: {
        getProjectById: vi.fn(),
      },
      projectSettingsRepository: {
        getProjectSettings: vi.fn(async () => null),
      },
      taskRepository: {
        archiveTask: vi.fn(),
        deleteTask: vi.fn(),
        getTaskById: vi.fn(async () => runningTask),
        hasActiveTaskInThread: vi.fn(),
        listTaskAgentEvents: vi.fn(),
        listTasksByProject: vi.fn(),
        updateTaskTitle: vi.fn(),
      },
      taskRunnerService: {
        createAndRunTask: vi.fn(),
        followupTask: vi.fn(),
        breakTaskTurn: vi.fn(),
        recoverInterruptedTasks: vi.fn(),
      },
    })

    await expect(
      taskService.archiveTask({
        taskId: runningTask.id,
      }),
    ).rejects.toMatchObject({
      code: createTaskError.invalidTaskArchiveState("").code,
    } satisfies Partial<TaskError>)
  })

  it("archives a terminal task and publishes an upsert event", async () => {
    const completedTask = buildTask({
      status: "completed",
    })
    const archivedTask = buildTask({
      ...completedTask,
      archivedAt: "2026-03-18T07:40:00.000Z",
    })

    const publish = vi.fn()
    const archiveTask = vi.fn(async () => archivedTask)

    const taskService = createTaskService({
      projectRepository: {
        getProjectById: vi.fn(),
      },
      projectSettingsRepository: {
        getProjectSettings: vi.fn(async () => null),
      },
      taskRepository: {
        archiveTask,
        deleteTask: vi.fn(),
        getTaskById: vi.fn(async () => completedTask),
        hasActiveTaskInThread: vi.fn(),
        listTaskAgentEvents: vi.fn(),
        listTasksByProject: vi.fn(),
        updateTaskTitle: vi.fn(),
      },
      taskRunnerService: {
        createAndRunTask: vi.fn(),
        followupTask: vi.fn(),
        breakTaskTurn: vi.fn(),
        recoverInterruptedTasks: vi.fn(),
      },
      taskEventBus: {
        publish,
      },
    })

    const result = await taskService.archiveTask({
      taskId: completedTask.id,
    })

    expect(result.archivedAt).toBe("2026-03-18T07:40:00.000Z")
    expect(archiveTask).toHaveBeenCalledWith({
      taskId: completedTask.id,
    })
    expect(publish).toHaveBeenCalledWith({
      type: "task_upsert",
      projectId: archivedTask.projectId,
      task: archivedTask,
    })
  })

  it("deletes a terminal task and publishes a delete event", async () => {
    const failedTask = buildTask({
      id: "task-delete-1",
      status: "failed",
    })

    const publish = vi.fn()
    const deleteTask = vi.fn(async () => ({
      taskId: failedTask.id,
      projectId: failedTask.projectId,
    }))

    const taskService = createTaskService({
      projectRepository: {
        getProjectById: vi.fn(),
      },
      projectSettingsRepository: {
        getProjectSettings: vi.fn(async () => null),
      },
      taskRepository: {
        archiveTask: vi.fn(),
        deleteTask,
        getTaskById: vi.fn(async () => failedTask),
        hasActiveTaskInThread: vi.fn(),
        listTaskAgentEvents: vi.fn(),
        listTasksByProject: vi.fn(),
        updateTaskTitle: vi.fn(),
      },
      taskRunnerService: {
        createAndRunTask: vi.fn(),
        followupTask: vi.fn(),
        breakTaskTurn: vi.fn(),
        recoverInterruptedTasks: vi.fn(),
      },
      taskEventBus: {
        publish,
      },
    })

    const result = await taskService.deleteTask({
      taskId: failedTask.id,
    })

    expect(result).toEqual({
      taskId: failedTask.id,
      projectId: failedTask.projectId,
    })
    expect(deleteTask).toHaveBeenCalledWith({
      taskId: failedTask.id,
    })
    expect(publish).toHaveBeenCalledWith({
      type: "task_deleted",
      projectId: failedTask.projectId,
      taskId: failedTask.id,
    })
  })
})
