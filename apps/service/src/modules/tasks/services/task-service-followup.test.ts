import { describe, expect, it, vi } from "vitest"

import { createTaskError, type TaskError } from "../errors"
import { createTaskService } from "./task.service"
import { buildTask } from "./task-test-helpers"

describe("task follow-up", () => {
  it("rejects follow-up while the task is still active", async () => {
    const runningTask = buildTask({
      status: "running",
      finishedAt: null,
    })
    const getTaskById = vi.fn(async () => runningTask)
    const hasActiveTaskInThread = vi.fn(async () => false)
    const followupTask = vi.fn()

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
        getTaskById,
        hasActiveTaskInThread,
        listTaskAgentEvents: vi.fn(),
        listTasksByProject: vi.fn(),
        updateTaskTitle: vi.fn(),
      },
      taskRunnerService: {
        createAndRunTask: vi.fn(),
        followupTask,
        breakTaskTurn: vi.fn(),
        recoverInterruptedTasks: vi.fn(),
      },
    })

    await expect(
      taskService.followupTask({
        taskId: runningTask.id,
        prompt: "Continue",
      }),
    ).rejects.toMatchObject({
      code: createTaskError.invalidTaskFollowupState("").code,
    } satisfies Partial<TaskError>)

    expect(hasActiveTaskInThread).not.toHaveBeenCalled()
    expect(followupTask).not.toHaveBeenCalled()
  })
})
