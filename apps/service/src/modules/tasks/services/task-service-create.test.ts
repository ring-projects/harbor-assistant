import { describe, expect, it, vi } from "vitest"

import { RUNTIME_POLICY_PRESETS } from "../runtime-policy"
import { createTaskService } from "./task.service"
import { buildProjectSettings, buildTask } from "./task-test-helpers"

describe("task creation", () => {
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

  it("does not apply Harbor skills to Codex tasks even when project settings enable them", async () => {
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
      agentType: "codex",
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
        agentPrompt: "Use Harbor skills",
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
    expect(ensureProjectSkillBridge).not.toHaveBeenCalled()
  })

  it("does not re-apply Harbor skill runtime access when retrying a failed Codex task", async () => {
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
        agentPrompt: "Initial prompt",
        runtimePolicy: RUNTIME_POLICY_PRESETS.connected,
      }),
    )
    expect(ensureProjectSkillBridge).not.toHaveBeenCalled()
  })
})
