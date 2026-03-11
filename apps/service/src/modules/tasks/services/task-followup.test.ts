import { describe, expect, it, vi } from "vitest"

import { createTaskError, TaskError } from "../errors"
import { createTaskRunnerService } from "./task-runner.service"
import { createTaskService } from "./task.service"
import type { CodexTask } from "../types"

function buildTask(overrides: Partial<CodexTask> = {}): CodexTask {
  return {
    id: "task-1",
    projectId: "project-1",
    projectPath: "/tmp/project-1",
    prompt: "Initial prompt",
    executor: "codex",
    model: "gpt-5",
    status: "completed",
    threadId: "thread-1",
    parentTaskId: null,
    createdAt: "2026-03-10T00:00:00.000Z",
    startedAt: "2026-03-10T00:00:01.000Z",
    finishedAt: "2026-03-10T00:00:02.000Z",
    exitCode: 0,
    command: ["agent", "startSession"],
    stdout: "existing stdout\n",
    stderr: "",
    error: null,
    ...overrides,
  }
}

describe("task follow-up", () => {
  it("reuses the same task record when resuming a thread", async () => {
    const existingTask = buildTask()
    const resumedTask = buildTask({
      status: "running",
      startedAt: "2026-03-10T00:05:00.000Z",
      finishedAt: null,
      command: ["agent", "resumeSession", "thread-1"],
    })
    const completedTask = buildTask({
      stdout: "existing stdout\nnew output\n",
      command: ["agent", "resumeSession", "thread-1"],
    })

    const createTask = vi.fn(async () => {
      throw new Error("follow-up should not create a new task")
    })
    const getTaskById = vi
      .fn()
      .mockResolvedValueOnce(existingTask)
      .mockResolvedValueOnce(existingTask)
    const updateTaskState = vi
      .fn()
      .mockResolvedValueOnce(resumedTask)
      .mockResolvedValueOnce(completedTask)
    const resumeSessionAndRun = vi.fn(async () => ({
      sessionId: "thread-1",
      stdout: "new output\n",
      stderr: "",
    }))

    const taskRunnerService = createTaskRunnerService({
      taskRepository: {
        createTask,
        getTaskById,
        updateTaskState,
      },
      taskAgentGateway: {
        startSessionAndRun: vi.fn(),
        resumeSessionAndRun,
      },
      taskEventBus: {
        publish: vi.fn(),
      },
    })

    const result = await taskRunnerService.followupTask({
      taskId: existingTask.id,
      threadId: existingTask.threadId ?? "thread-1",
      projectId: existingTask.projectId,
      projectPath: existingTask.projectPath,
      prompt: "Continue",
      model: existingTask.model,
    })

    expect(result.id).toBe(existingTask.id)
    expect(createTask).not.toHaveBeenCalled()
    expect(updateTaskState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        taskId: existingTask.id,
        status: "running",
        finishedAt: null,
        exitCode: null,
      }),
    )

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(resumeSessionAndRun).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: existingTask.id,
        sessionId: "thread-1",
        prompt: "Continue",
      }),
    )
    expect(updateTaskState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        taskId: existingTask.id,
        status: "completed",
        stdout: "existing stdout\nnew output\n",
      }),
    )
  })

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
      taskRepository: {
        getTaskById,
        hasActiveTaskInThread,
        listTaskAgentEvents: vi.fn(),
        listTasksByProject: vi.fn(),
      },
      taskRunnerService: {
        createAndRunTask: vi.fn(),
        followupTask,
        cancelTask: vi.fn(),
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
