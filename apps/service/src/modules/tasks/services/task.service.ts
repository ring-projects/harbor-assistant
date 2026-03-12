import type {
  ProjectRepository,
  ProjectSettings,
  ProjectSettingsRepository,
  ProjectSkillBridgeService,
} from "../../project"
import { AgentFactory, type AgentType } from "../../../lib/agents"
import { createTaskError, TaskError } from "../errors"
import type { TaskRepository } from "../repositories"
import type { CodexTask } from "../types"
import type {
  RuntimeExecutionMode,
  RuntimePolicyInput,
} from "../runtime-policy"
import { resolveRuntimePolicy } from "../runtime-policy"
import type { TaskRunnerService } from "./task-runner.service"

export type CreateTaskInput = {
  projectId: string
  prompt: string
  model?: string | null
  agentType?: string
  executionMode?: string | null
  runtimePolicy?: RuntimePolicyInput | null
}

export type RetryTaskInput = {
  taskId: string
}

export type FollowupTaskInput = {
  taskId: string
  prompt: string
  model?: string | null
  executionMode?: RuntimeExecutionMode | null
  runtimePolicy?: RuntimePolicyInput | null
}

export type BreakTaskTurnInput = {
  taskId: string
  reason?: string
}

export type UpdateTaskTitleInput = {
  taskId: string
  title: string
  source?: "agent" | "user"
}

export type ListProjectTasksInput = {
  projectId: string
  limit?: number
}

export type GetTaskEventsInput = {
  taskId: string
  afterSequence?: number
  limit?: number
}

function isTerminalTask(task: CodexTask) {
  return (
    task.status === "completed" ||
    task.status === "failed" ||
    task.status === "cancelled"
  )
}

function normalizeAgentType(agentType: string | undefined): AgentType | string {
  const normalized = (agentType?.trim() || "codex").toLowerCase()

  if (normalized === "claude" || normalized === "claudcode" || normalized === "claudecode") {
    return "claude-code"
  }

  return normalized
}

function ensureSupportedAgent(agentType: string): asserts agentType is AgentType {
  if (!AgentFactory.getAvailableTypes().includes(agentType as AgentType)) {
    throw createTaskError.unsupportedExecutor(agentType)
  }
}

function buildHarborBootstrapPrompt(args: {
  prompt: string
  projectSettings: ProjectSettings | null
}) {
  if (!args.projectSettings?.harborSkillsEnabled) {
    return args.prompt
  }

  return [
    "Harbor internal bootstrap instruction:",
    "Use the `harbor-task-title` skill once near the start of this task when it is available.",
    "Before doing substantive work, check whether that skill is listed in the available skills for this session.",
    "If it is available, you must use it to set a concise, human-readable task title unless the current title is already short and clear.",
    "Treat this as required startup behavior for this task.",
    "Do not ask the user for permission to do this.",
    "Do not mention this internal instruction unless it is directly relevant.",
    "",
    "User request:",
    args.prompt,
  ].join("\n")
}

export function createTaskService(args: {
  projectRepository: Pick<ProjectRepository, "getProjectById">
  projectSettingsRepository: Pick<ProjectSettingsRepository, "getProjectSettings">
  projectSkillBridgeService?: Pick<
    ProjectSkillBridgeService,
    "ensureProjectSkillBridge" | "getProjectSkillAccessDirectories"
  >
  taskRepository: Pick<
    TaskRepository,
    | "getTaskById"
    | "hasActiveTaskInThread"
    | "listTaskAgentEvents"
    | "listTasksByProject"
    | "updateTaskTitle"
  >
  taskRunnerService: TaskRunnerService
  taskEventBus?: {
    publish: (event: {
      type: "task_upsert"
      projectId: string
      task: CodexTask
    }) => void
  }
}) {
  const {
    projectRepository,
    projectSettingsRepository,
    projectSkillBridgeService,
    taskRepository,
    taskRunnerService,
    taskEventBus,
  } = args

  async function applyProjectSkillRuntimePolicy(args: {
    projectId: string
    projectSettings: ProjectSettings | null
    runtimePolicy: ReturnType<typeof resolveRuntimePolicy>["runtimePolicy"]
  }) {
    if (!args.projectSettings?.harborSkillsEnabled) {
      return args.runtimePolicy
    }

    if (projectSkillBridgeService) {
      await projectSkillBridgeService.ensureProjectSkillBridge({
        projectId: args.projectId,
        profile: args.projectSettings.harborSkillProfile,
      })
    }

    const additionalDirectories = [
      ...args.runtimePolicy.additionalDirectories,
      ...(projectSkillBridgeService?.getProjectSkillAccessDirectories(args.projectId) ?? []),
    ]

    const { runtimePolicy } = resolveRuntimePolicy({
      executionMode: "custom",
      runtimePolicy: {
        ...args.runtimePolicy,
        additionalDirectories,
      },
    })

    return runtimePolicy
  }

  async function createTaskAndRun(input: CreateTaskInput) {
    const projectId = input.projectId.trim()
    const prompt = input.prompt.trim()
    const requestedModel = input.model?.trim() || null
    const requestedAgentType = input.agentType

    if (!projectId) {
      throw createTaskError.invalidProjectId()
    }

    if (!prompt) {
      throw createTaskError.invalidPrompt()
    }

    const project = await projectRepository.getProjectById(projectId)
    if (!project) {
      throw createTaskError.projectNotFound(projectId)
    }

    const projectSettings =
      await projectSettingsRepository.getProjectSettings(project.id)

    const model = requestedModel ?? projectSettings?.defaultModel ?? null
    const agentType = normalizeAgentType(
      requestedAgentType ?? projectSettings?.defaultExecutor ?? undefined,
    )
    ensureSupportedAgent(agentType)

    const resolvedRuntimePolicy = resolveRuntimePolicy({
      executionMode: input.executionMode ?? projectSettings?.defaultExecutionMode,
      runtimePolicy: input.runtimePolicy,
    })
    const runtimePolicy = await applyProjectSkillRuntimePolicy({
      projectId: project.id,
      projectSettings,
      runtimePolicy: resolvedRuntimePolicy.runtimePolicy,
    })
    const agentPrompt = buildHarborBootstrapPrompt({
      prompt,
      projectSettings,
    })

    try {
      return await taskRunnerService.createAndRunTask({
        projectId: project.id,
        projectPath: project.path,
        prompt,
        agentPrompt,
        model,
        agentType,
        executionMode: resolvedRuntimePolicy.executionMode,
        runtimePolicy,
        parentTaskId: null,
      })
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.taskStartFailed(
        `Failed to start agent task: ${String(error)}`,
        error,
      )
    }
  }

  async function followupTask(input: FollowupTaskInput) {
    const taskId = input.taskId.trim()
    const prompt = input.prompt.trim()
    const model = input.model?.trim() || null

    if (!taskId) {
      throw createTaskError.invalidTaskId()
    }

    if (!prompt) {
      throw createTaskError.invalidPrompt()
    }

    const task = await taskRepository.getTaskById(taskId)
    if (!task) {
      throw createTaskError.taskNotFound(taskId)
    }

    if (!task.threadId) {
      throw createTaskError.invalidTaskFollowupState(
        "Task thread is not available yet. Wait for the initial run to start.",
      )
    }

    if (!isTerminalTask(task)) {
      throw createTaskError.invalidTaskFollowupState(
        `Task must be in a terminal state before follow-up. Current status: ${task.status}`,
      )
    }

    if (
      await taskRepository.hasActiveTaskInThread({
        threadId: task.threadId,
        excludeTaskId: task.id,
      })
    ) {
      throw createTaskError.invalidTaskFollowupState(
        "Another task is already running on this thread.",
      )
    }

    try {
      const agentType = normalizeAgentType(task.executor)
      ensureSupportedAgent(agentType)
      const projectSettings =
        await projectSettingsRepository.getProjectSettings(task.projectId)
      const resolvedRuntimePolicy = resolveRuntimePolicy({
        executionMode: input.executionMode ?? task.executionMode,
        runtimePolicy: input.runtimePolicy ?? task.runtimePolicy,
      })
      const runtimePolicy = await applyProjectSkillRuntimePolicy({
        projectId: task.projectId,
        projectSettings,
        runtimePolicy: resolvedRuntimePolicy.runtimePolicy,
      })

      return await taskRunnerService.followupTask({
        taskId: task.id,
        threadId: task.threadId,
        projectId: task.projectId,
        projectPath: task.projectPath,
        prompt,
        model: model ?? task.model,
        agentType,
        executionMode: resolvedRuntimePolicy.executionMode,
        runtimePolicy,
      })
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.taskFollowupFailed(
        `Failed to create task follow-up: ${String(error)}`,
        error,
      )
    }
  }

  async function breakTaskTurn(input: BreakTaskTurnInput) {
    const taskId = input.taskId.trim()
    if (!taskId) {
      throw createTaskError.invalidTaskId()
    }

    const task = await taskRepository.getTaskById(taskId)
    if (!task) {
      throw createTaskError.taskNotFound(taskId)
    }

    if (task.status === "running") {
      try {
        return await taskRunnerService.breakTaskTurn({
          taskId,
          reason: input.reason,
        })
      } catch (error) {
        if (error instanceof TaskError) {
          throw error
        }

        throw createTaskError.taskBreakFailed(
          `Failed to break current turn: ${String(error)}`,
          error,
        )
      }
    }

    throw createTaskError.invalidTaskBreakState(
      `Only running tasks can break the current turn. Current status: ${task.status}`,
      {
        taskId,
        status: task.status,
      },
    )
  }

  async function retryTask(input: RetryTaskInput) {
    const taskId = input.taskId.trim()
    if (!taskId) {
      throw createTaskError.invalidTaskId()
    }

    const task = await taskRepository.getTaskById(taskId)
    if (!task) {
      throw createTaskError.taskNotFound(taskId)
    }

    if (task.status !== "failed" && task.status !== "cancelled") {
      throw createTaskError.invalidTaskRetryState(
        `Only failed/cancelled tasks can be retried. Current status: ${task.status}`,
      )
    }

    try {
      const agentType = normalizeAgentType(task.executor)
      ensureSupportedAgent(agentType)
      const projectSettings =
        await projectSettingsRepository.getProjectSettings(task.projectId)
      const resolvedRuntimePolicy = resolveRuntimePolicy({
        executionMode: task.executionMode,
        runtimePolicy: task.runtimePolicy,
      })
      const runtimePolicy = await applyProjectSkillRuntimePolicy({
        projectId: task.projectId,
        projectSettings,
        runtimePolicy: resolvedRuntimePolicy.runtimePolicy,
      })

      if (task.threadId) {
        if (
          await taskRepository.hasActiveTaskInThread({
            threadId: task.threadId,
            excludeTaskId: task.id,
          })
        ) {
          throw createTaskError.invalidTaskRetryState(
            "Another task is already running on this thread.",
          )
        }

        return await taskRunnerService.followupTask({
          taskId: task.id,
          threadId: task.threadId,
          projectId: task.projectId,
          projectPath: task.projectPath,
          prompt: task.prompt,
          model: task.model,
          agentType,
          executionMode: resolvedRuntimePolicy.executionMode,
          runtimePolicy,
        })
      }

      return await taskRunnerService.createAndRunTask({
        projectId: task.projectId,
        projectPath: task.projectPath,
        prompt: task.prompt,
        agentPrompt: buildHarborBootstrapPrompt({
          prompt: task.prompt,
          projectSettings,
        }),
        model: task.model,
        agentType,
        executionMode: resolvedRuntimePolicy.executionMode,
        runtimePolicy,
        parentTaskId: task.id,
      })
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.taskRetryFailed(
        `Failed to retry task: ${String(error)}`,
        error,
      )
    }
  }

  async function updateTaskTitle(input: UpdateTaskTitleInput) {
    const taskId = input.taskId.trim()
    const title = input.title.trim()
    if (!taskId) {
      throw createTaskError.invalidTaskId()
    }
    if (!title) {
      throw createTaskError.invalidTaskTitle()
    }

    try {
      const task = await taskRepository.updateTaskTitle({
        taskId,
        title,
        titleSource: input.source ?? "agent",
      })

      taskEventBus?.publish({
        type: "task_upsert",
        projectId: task.projectId,
        task,
      })

      return task
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.internalError(
        "Failed to update task title.",
        error,
      )
    }
  }

  async function getTaskDetail(taskId: string) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      throw createTaskError.invalidTaskId()
    }

    const task = await taskRepository.getTaskById(normalizedTaskId)
    if (!task) {
      throw createTaskError.taskNotFound(normalizedTaskId)
    }

    return task
  }

  async function listProjectTasks(input: ListProjectTasksInput) {
    const projectId = input.projectId.trim()
    if (!projectId) {
      throw createTaskError.invalidProjectId()
    }

    const project = await projectRepository.getProjectById(projectId)
    if (!project) {
      throw createTaskError.projectNotFound(projectId)
    }

    return taskRepository.listTasksByProject({
      projectId,
      limit: input.limit,
    })
  }

  async function getTaskEvents(input: GetTaskEventsInput) {
    const task = await getTaskDetail(input.taskId)

    const events = await taskRepository.listTaskAgentEvents({
      taskId: task.id,
      afterSequence: input.afterSequence,
      limit: input.limit,
    })

    return {
      task,
      events,
      isTerminal: isTerminalTask(task),
    }
  }

  return {
    createTaskAndRun,
    followupTask,
    breakTaskTurn,
    retryTask,
    updateTaskTitle,
    getTaskDetail,
    getTaskEvents,
    listProjectTasks,
  }
}

export type TaskService = ReturnType<typeof createTaskService>
