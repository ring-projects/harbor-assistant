import { describe, expect, it, vi } from "vitest"

import { createTaskError, type TaskError } from "../errors"
import { createTaskService } from "./task.service"
import { buildProjectSettings, buildTask } from "./task-test-helpers"

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

  it("allows follow-up to switch to runtime default", async () => {
    const completedTask = buildTask({
      status: "completed",
      model: "gpt-5",
      threadId: "thread-1",
    })
    const getTaskById = vi.fn(async () => completedTask)
    const hasActiveTaskInThread = vi.fn(async () => false)
    const followupTask = vi.fn(async () => buildTask({ model: null }))

    const taskService = createTaskService({
      projectRepository: {
        getProjectById: vi.fn(),
      },
      projectSettingsRepository: {
        getProjectSettings: vi.fn(async () => buildProjectSettings()),
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

    await taskService.followupTask({
      taskId: completedTask.id,
      prompt: "Continue with runtime default",
      modelSource: "runtime-default",
    })

    expect(followupTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: completedTask.id,
        threadId: completedTask.threadId,
        model: null,
      }),
    )
  })

  it("rejects unsupported follow-up models when the executor model list is known", async () => {
    const completedTask = buildTask({
      status: "completed",
      model: "gpt-5",
      threadId: "thread-1",
      executor: "codex",
    })
    const followupTask = vi.fn()

    const taskService = createTaskService({
      projectRepository: {
        getProjectById: vi.fn(),
      },
      projectSettingsRepository: {
        getProjectSettings: vi.fn(async () => buildProjectSettings()),
      },
      taskRepository: {
        archiveTask: vi.fn(),
        deleteTask: vi.fn(),
        getTaskById: vi.fn(async () => completedTask),
        hasActiveTaskInThread: vi.fn(async () => false),
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
      inspectAgentCapabilities: vi.fn(async () => ({
        checkedAt: new Date("2026-03-18T00:00:00.000Z"),
        availableAgents: ["codex" as const],
        agents: {
          codex: {
            installed: true,
            version: "codex-cli 0.64.0",
            models: [
              {
                id: "gpt-5",
                displayName: "GPT-5",
                isDefault: true,
              },
            ],
            supportsResume: true,
            supportsStreaming: true,
          },
          "claude-code": {
            installed: true,
            version: "claude-code 1.0.0",
            models: [],
            supportsResume: true,
            supportsStreaming: true,
          },
        },
      })),
    })

    await expect(
      taskService.followupTask({
        taskId: completedTask.id,
        prompt: "Switch models",
        model: "gpt-4.1",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_TASK_MODEL",
      statusCode: 400,
    })

    expect(followupTask).not.toHaveBeenCalled()
  })
})
