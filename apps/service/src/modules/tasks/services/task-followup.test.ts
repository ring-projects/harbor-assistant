import { describe, expect, it, vi } from "vitest"

import { createTaskError, TaskError } from "../errors"
import { RUNTIME_POLICY_PRESETS } from "../runtime-policy"
import { createTaskRunnerService } from "./task-runner.service"
import { createTaskService } from "./task.service"
import type { CodexTask } from "../types"

function buildTask(overrides: Partial<CodexTask> = {}): CodexTask {
  return {
    id: "task-1",
    projectId: "project-1",
    projectPath: "/tmp/project-1",
    prompt: "Initial prompt",
    title: "Initial prompt",
    titleSource: "prompt",
    titleUpdatedAt: "2026-03-10T00:00:00.000Z",
    executor: "codex",
    executionMode: "safe",
    runtimePolicy: RUNTIME_POLICY_PRESETS.safe,
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

function buildProjectSettings(overrides: Partial<{
  defaultExecutor: string | null
  defaultModel: string | null
  defaultExecutionMode: string | null
  harborSkillsEnabled: boolean
  harborSkillProfile: string | null
}> = {}) {
  return {
    projectId: "project-1",
    defaultExecutor: "codex",
    defaultModel: null,
    defaultExecutionMode: "safe",
    maxConcurrentTasks: 1,
    logRetentionDays: 30,
    eventRetentionDays: 7,
    harborSkillsEnabled: true,
    harborSkillProfile: "default",
    createdAt: new Date("2026-03-10T00:00:00.000Z"),
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
    ...overrides,
  }
}

describe("task follow-up", () => {
  it("normalizes Claude executor aliases before starting a task", async () => {
    const project = {
      id: "project-1",
      name: "Project One",
      slug: "project-one",
      path: "/tmp/project-1",
      rootPath: "/tmp/project-1",
      normalizedPath: "/tmp/project-1",
      description: null,
      status: "active" as const,
      createdAt: new Date("2026-03-10T00:00:00.000Z"),
      updatedAt: new Date("2026-03-10T00:00:00.000Z"),
      archivedAt: null,
      lastOpenedAt: null,
    }
    const createdTask = buildTask({
      status: "running",
      executor: "claude-code",
    })
    const createAndRunTask = vi.fn(async () => createdTask)
    const ensureProjectSkillBridge = vi.fn()

    const taskService = createTaskService({
      projectRepository: {
        getProjectById: vi.fn(async () => project),
      },
      projectSettingsRepository: {
        getProjectSettings: vi.fn(async () => buildProjectSettings()),
      },
      projectSkillBridgeService: {
        ensureProjectSkillBridge,
        getProjectSkillAccessDirectories: vi.fn(() => ["/tmp/harbor-skills"]),
      },
      taskRepository: {
        getTaskById: vi.fn(),
        hasActiveTaskInThread: vi.fn(),
        listTaskAgentEvents: vi.fn(),
        listTasksByProject: vi.fn(),
        updateTaskTitle: vi.fn(),
      },
      taskRunnerService: {
        createAndRunTask,
        followupTask: vi.fn(),
        breakTaskTurn: vi.fn(),
        recoverInterruptedTasks: vi.fn(),
      },
    })

    await taskService.createTaskAndRun({
      projectId: project.id,
      prompt: "Use Claude",
      agentType: "claude",
      executionMode: "connected",
    })

    expect(createAndRunTask).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: project.id,
        projectPath: project.path,
        prompt: "Use Claude",
        displayPrompt: "Use Claude",
        agentPrompt: expect.stringContaining(
          "Internal: if `harbor-task-title` is available in this session, use it once near the start to set a concise task title.",
        ),
        agentType: "claude-code",
        executionMode: "connected",
        runtimePolicy: {
          ...RUNTIME_POLICY_PRESETS.connected,
          additionalDirectories: ["/tmp/harbor-skills"],
        },
      }),
    )
    expect(ensureProjectSkillBridge).toHaveBeenCalledWith({
      projectId: project.id,
      profile: "default",
    })
  })

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

  it("inherits project executor, model, and execution mode defaults", async () => {
    const project = {
      id: "project-1",
      name: "Project One",
      slug: "project-one",
      path: "/tmp/project-1",
      rootPath: "/tmp/project-1",
      normalizedPath: "/tmp/project-1",
      description: null,
      status: "active" as const,
      createdAt: new Date("2026-03-10T00:00:00.000Z"),
      updatedAt: new Date("2026-03-10T00:00:00.000Z"),
      archivedAt: null,
      lastOpenedAt: null,
    }
    const createAndRunTask = vi.fn(async () =>
      buildTask({
        executor: "claude-code",
        model: "claude-sonnet-4-5",
        executionMode: "full-access",
        runtimePolicy: RUNTIME_POLICY_PRESETS["full-access"],
      }),
    )

    const taskService = createTaskService({
      projectRepository: {
        getProjectById: vi.fn(async () => project),
      },
      projectSettingsRepository: {
        getProjectSettings: vi.fn(async () =>
          buildProjectSettings({
            defaultExecutor: "claude-code",
            defaultModel: "claude-sonnet-4-5",
            defaultExecutionMode: "full-access",
          }),
        ),
      },
      taskRepository: {
        getTaskById: vi.fn(),
        hasActiveTaskInThread: vi.fn(),
        listTaskAgentEvents: vi.fn(),
        listTasksByProject: vi.fn(),
        updateTaskTitle: vi.fn(),
      },
      taskRunnerService: {
        createAndRunTask,
        followupTask: vi.fn(),
        breakTaskTurn: vi.fn(),
        recoverInterruptedTasks: vi.fn(),
      },
    })

    await taskService.createTaskAndRun({
      projectId: project.id,
      prompt: "Use project defaults",
    })

    expect(createAndRunTask).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: project.id,
        prompt: "Use project defaults",
        displayPrompt: "Use project defaults",
        agentPrompt: expect.stringContaining("Use project defaults"),
        model: "claude-sonnet-4-5",
        agentType: "claude-code",
        executionMode: "full-access",
        runtimePolicy: RUNTIME_POLICY_PRESETS["full-access"],
      }),
    )
  })

  it("merges Harbor skill access directories into an explicit custom runtime policy", async () => {
    const project = {
      id: "project-1",
      name: "Project One",
      slug: "project-one",
      path: "/tmp/project-1",
      rootPath: "/tmp/project-1",
      normalizedPath: "/tmp/project-1",
      description: null,
      status: "active" as const,
      createdAt: new Date("2026-03-10T00:00:00.000Z"),
      updatedAt: new Date("2026-03-10T00:00:00.000Z"),
      archivedAt: null,
      lastOpenedAt: null,
    }
    const createAndRunTask = vi.fn(async () => buildTask({ status: "running" }))
    const ensureProjectSkillBridge = vi.fn()

    const taskService = createTaskService({
      projectRepository: {
        getProjectById: vi.fn(async () => project),
      },
      projectSettingsRepository: {
        getProjectSettings: vi.fn(async () => buildProjectSettings()),
      },
      projectSkillBridgeService: {
        ensureProjectSkillBridge,
        getProjectSkillAccessDirectories: vi.fn(() => ["/tmp/harbor-skills"]),
      },
      taskRepository: {
        getTaskById: vi.fn(),
        hasActiveTaskInThread: vi.fn(),
        listTaskAgentEvents: vi.fn(),
        listTasksByProject: vi.fn(),
        updateTaskTitle: vi.fn(),
      },
      taskRunnerService: {
        createAndRunTask,
        followupTask: vi.fn(),
        breakTaskTurn: vi.fn(),
        recoverInterruptedTasks: vi.fn(),
      },
    })

    await taskService.createTaskAndRun({
      projectId: project.id,
      prompt: "Use Harbor skills",
      executionMode: "custom",
      runtimePolicy: {
        sandboxMode: "workspace-write",
        approvalPolicy: "never",
        networkAccessEnabled: true,
        webSearchMode: "live",
        additionalDirectories: ["/tmp/project-1/.cache", "/tmp/harbor-skills"],
      },
    })

    expect(createAndRunTask).toHaveBeenCalledWith(
      expect.objectContaining({
        displayPrompt: "Use Harbor skills",
        agentPrompt: expect.stringContaining("Use Harbor skills"),
        runtimePolicy: {
          sandboxMode: "workspace-write",
          approvalPolicy: "never",
          networkAccessEnabled: true,
          webSearchMode: "live",
          additionalDirectories: [
            "/tmp/project-1/.cache",
            "/tmp/harbor-skills",
          ],
        },
      }),
    )
    expect(ensureProjectSkillBridge).toHaveBeenCalledWith({
      projectId: project.id,
      profile: "default",
    })
  })

  it("re-applies Harbor skill runtime access when retrying a failed task", async () => {
    const failedTask = buildTask({
      status: "failed",
      threadId: null,
      runtimePolicy: RUNTIME_POLICY_PRESETS.connected,
    })
    const createAndRunTask = vi.fn(async () => failedTask)
    const ensureProjectSkillBridge = vi.fn()

    const taskService = createTaskService({
      projectRepository: {
        getProjectById: vi.fn(),
      },
      projectSettingsRepository: {
        getProjectSettings: vi.fn(async () => buildProjectSettings()),
      },
      projectSkillBridgeService: {
        ensureProjectSkillBridge,
        getProjectSkillAccessDirectories: vi.fn(() => ["/tmp/harbor-skills"]),
      },
      taskRepository: {
        getTaskById: vi.fn(async () => failedTask),
        hasActiveTaskInThread: vi.fn(async () => false),
        listTaskAgentEvents: vi.fn(),
        listTasksByProject: vi.fn(),
        updateTaskTitle: vi.fn(),
      },
      taskRunnerService: {
        createAndRunTask,
        followupTask: vi.fn(),
        breakTaskTurn: vi.fn(),
        recoverInterruptedTasks: vi.fn(),
      },
    })

    await taskService.retryTask({
      taskId: failedTask.id,
    })

    expect(createAndRunTask).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: failedTask.projectId,
        parentTaskId: failedTask.id,
        displayPrompt: "Initial prompt",
        agentPrompt: expect.stringContaining("Initial prompt"),
        runtimePolicy: {
          ...RUNTIME_POLICY_PRESETS.connected,
          additionalDirectories: ["/tmp/harbor-skills"],
        },
      }),
    )
    expect(ensureProjectSkillBridge).toHaveBeenCalledWith({
      projectId: failedTask.projectId,
      profile: "default",
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
    const getTaskById = vi
      .fn()
      .mockResolvedValueOnce(runningTask)
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
