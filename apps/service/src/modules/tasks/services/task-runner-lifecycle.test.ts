import { describe, expect, it, vi } from "vitest"

import { RUNTIME_POLICY_PRESETS } from "../runtime-policy"
import { createTaskRunnerService } from "./task-runner.service"
import { buildTask } from "./task-test-helpers"

describe("task runner lifecycle", () => {
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
        listTasksByStatuses: vi.fn(async () => []),
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
      agentType: "codex",
      executionMode: existingTask.executionMode ?? "safe",
      runtimePolicy: existingTask.runtimePolicy ?? RUNTIME_POLICY_PRESETS.safe,
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
        agentType: "codex",
        runtimePolicy: existingTask.runtimePolicy,
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

  it("recovers queued and running tasks after service restart", async () => {
    const queuedTask = buildTask({
      id: "task-queued",
      status: "queued",
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      error: null,
    })
    const runningTask = buildTask({
      id: "task-running",
      status: "running",
      startedAt: "2026-03-10T00:05:00.000Z",
      finishedAt: null,
      exitCode: null,
      error: null,
    })
    const recoveredQueuedTask = buildTask({
      ...queuedTask,
      status: "failed",
      finishedAt: "2026-03-10T00:10:00.000Z",
      error:
        "Task was interrupted because Harbor service restarted before execution began.",
    })
    const recoveredRunningTask = buildTask({
      ...runningTask,
      status: "failed",
      finishedAt: "2026-03-10T00:10:01.000Z",
      error:
        "Task was interrupted because Harbor service restarted during execution.",
    })

    const listTasksByStatuses = vi.fn(async () => [queuedTask, runningTask])
    const updateTaskState = vi
      .fn()
      .mockResolvedValueOnce(recoveredQueuedTask)
      .mockResolvedValueOnce(recoveredRunningTask)
    const publish = vi.fn()

    const taskRunnerService = createTaskRunnerService({
      taskRepository: {
        createTask: vi.fn(),
        listTasksByStatuses,
        getTaskById: vi.fn(),
        updateTaskState,
      },
      taskAgentGateway: {
        startSessionAndRun: vi.fn(),
        resumeSessionAndRun: vi.fn(),
      },
      taskEventBus: {
        publish,
      },
    })

    const recoveredTasks = await taskRunnerService.recoverInterruptedTasks()

    expect(listTasksByStatuses).toHaveBeenCalledWith({
      statuses: ["queued", "running"],
    })
    expect(updateTaskState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        taskId: "task-queued",
        status: "failed",
        exitCode: null,
        error:
          "Task was interrupted because Harbor service restarted before execution began.",
      }),
    )
    expect(updateTaskState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        taskId: "task-running",
        status: "failed",
        exitCode: null,
        error:
          "Task was interrupted because Harbor service restarted during execution.",
      }),
    )
    expect(recoveredTasks).toEqual([recoveredQueuedTask, recoveredRunningTask])
    expect(publish).toHaveBeenCalledWith({
      type: "task_upsert",
      projectId: recoveredQueuedTask.projectId,
      task: recoveredQueuedTask,
    })
    expect(publish).toHaveBeenCalledWith({
      type: "task_end",
      taskId: recoveredRunningTask.id,
      status: "failed",
      cursor: 0,
    })
  })

  it("breaks a running turn and does not complete when the agent resolves afterwards", async () => {
    let resolveRun!: (value: {
      sessionId: string
      stdout: string
      stderr: string
    }) => void

    const queuedTask = buildTask({
      status: "queued",
      threadId: null,
      startedAt: null,
      finishedAt: null,
      stdout: "",
    })
    const runningTask = buildTask({
      status: "running",
      threadId: null,
      startedAt: "2026-03-10T00:05:00.000Z",
      finishedAt: null,
      stdout: "",
    })
    const brokenTask = buildTask({
      status: "cancelled",
      threadId: "thread-1",
      startedAt: "2026-03-10T00:05:00.000Z",
      finishedAt: "2026-03-10T00:05:10.000Z",
      stdout: "",
      error: "Current turn stopped by user request.",
    })

    const createTask = vi.fn(async () => queuedTask)
    const getTaskById = vi.fn().mockResolvedValueOnce(runningTask)
    const updateTaskState = vi
      .fn()
      .mockResolvedValueOnce(runningTask)
      .mockResolvedValueOnce(brokenTask)

    const startSessionAndRun = vi.fn(
      () =>
        new Promise<{ sessionId: string; stdout: string; stderr: string }>((resolve) => {
          resolveRun = resolve
        }),
    )

    const taskRunnerService = createTaskRunnerService({
      taskRepository: {
        createTask,
        listTasksByStatuses: vi.fn(async () => []),
        getTaskById,
        updateTaskState,
      },
      taskAgentGateway: {
        startSessionAndRun,
        resumeSessionAndRun: vi.fn(),
      },
      taskEventBus: {
        publish: vi.fn(),
      },
    })

    await taskRunnerService.createAndRunTask({
      projectId: queuedTask.projectId,
      projectPath: queuedTask.projectPath,
      prompt: queuedTask.prompt,
      model: queuedTask.model,
      agentType: "codex",
      executionMode: queuedTask.executionMode ?? "safe",
      runtimePolicy: queuedTask.runtimePolicy ?? RUNTIME_POLICY_PRESETS.safe,
    })

    await taskRunnerService.breakTaskTurn({
      taskId: runningTask.id,
    })

    resolveRun({
      sessionId: "thread-1",
      stdout: "late output",
      stderr: "",
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(updateTaskState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        taskId: runningTask.id,
        status: "cancelled",
        error: "Current turn stopped by user request.",
      }),
    )
    expect(updateTaskState).toHaveBeenCalledTimes(2)
  })
})
