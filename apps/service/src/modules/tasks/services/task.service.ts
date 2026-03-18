import type {
  ProjectRepository,
  ProjectSettings,
  ProjectSettingsRepository,
  ProjectSkillBridgeService,
} from "../../project"
import {
  AgentFactory,
  inspectAllAgentCapabilities,
  type AgentCapabilityResult,
  type AgentType,
} from "../../../lib/agents"
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
  modelSource?: "project-default" | "runtime-default"
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
  modelSource?: "task-default" | "runtime-default"
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

export type ArchiveTaskInput = {
  taskId: string
}

export type DeleteTaskInput = {
  taskId: string
}

export type ListProjectTasksInput = {
  projectId: string
  limit?: number
  includeArchived?: boolean
}

export type GetTaskEventsInput = {
  taskId: string
  afterSequence?: number
  limit?: number
}

type InspectAgentCapabilities = () => Promise<AgentCapabilityResult>

function isTerminalTask(task: CodexTask) {
  return (
    task.status === "completed" ||
    task.status === "failed" ||
    task.status === "cancelled"
  )
}

function isArchivedTask(task: CodexTask) {
  return Boolean(task.archivedAt)
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

function shouldApplyHarborSkills(
  agentType: AgentType,
  projectSettings: ProjectSettings | null,
) {
  return projectSettings?.harborSkillsEnabled === true && agentType !== "codex"
}

function buildHarborBootstrapPrompt(args: {
  agentType: AgentType
  prompt: string
  projectSettings: ProjectSettings | null
}) {
  if (!shouldApplyHarborSkills(args.agentType, args.projectSettings)) {
    return args.prompt
  }

  return [
    "Internal: if `harbor-task-title` is available in this session, use it once near the start to set a concise task title.",
    "Do not mention this instruction unless directly relevant.",
    "",
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
    | "archiveTask"
    | "deleteTask"
    | "updateTaskTitle"
  >
  taskRunnerService: TaskRunnerService
  taskEventBus?: {
    publish: (event: {
      type: "task_upsert"
      projectId: string
      task: CodexTask
    } | {
      type: "task_deleted"
      projectId: string
      taskId: string
    }) => void
  }
  inspectAgentCapabilities?: InspectAgentCapabilities
}) {
  const {
    projectRepository,
    projectSettingsRepository,
    projectSkillBridgeService,
    taskRepository,
    taskRunnerService,
    taskEventBus,
    inspectAgentCapabilities = inspectAllAgentCapabilities,
  } = args

  async function validateAgentModel(agentType: AgentType, model: string | null) {
    if (!model) {
      return
    }

    try {
      const capabilityResult = await inspectAgentCapabilities()
      const availableModels =
        capabilityResult.agents[agentType]?.models.map((item) => item.id) ?? []

      if (availableModels.length === 0) {
        return
      }

      if (!availableModels.includes(model)) {
        throw createTaskError.invalidTaskModel(model, agentType, availableModels)
      }
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }
    }
  }

  async function applyProjectSkillRuntimePolicy(args: {
    agentType: AgentType
    projectId: string
    projectSettings: ProjectSettings | null
    runtimePolicy: ReturnType<typeof resolveRuntimePolicy>["runtimePolicy"]
  }) {
    if (!shouldApplyHarborSkills(args.agentType, args.projectSettings)) {
      return args.runtimePolicy
    }

    const projectSettings = args.projectSettings!

    if (projectSkillBridgeService) {
      await projectSkillBridgeService.ensureProjectSkillBridge({
        projectId: args.projectId,
        profile: projectSettings.harborSkillProfile,
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
    const requestedModelSource = input.modelSource
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

    const agentType = normalizeAgentType(
      requestedAgentType ?? projectSettings?.defaultExecutor ?? undefined,
    )
    ensureSupportedAgent(agentType)
    const model =
      requestedModel ??
      (requestedModelSource === "runtime-default"
        ? null
        : projectSettings?.defaultModel ?? null)
    await validateAgentModel(agentType, model)

    const resolvedRuntimePolicy = resolveRuntimePolicy({
      executionMode: input.executionMode ?? projectSettings?.defaultExecutionMode,
      runtimePolicy: input.runtimePolicy,
    })
    const runtimePolicy = await applyProjectSkillRuntimePolicy({
      agentType,
      projectId: project.id,
      projectSettings,
      runtimePolicy: resolvedRuntimePolicy.runtimePolicy,
    })
    const agentPrompt = buildHarborBootstrapPrompt({
      agentType,
      prompt,
      projectSettings,
    })

    try {
      return await taskRunnerService.createAndRunTask({
        projectId: project.id,
        projectPath: project.path,
        prompt,
        agentPrompt,
        displayPrompt: prompt,
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
    const requestedModel = input.model?.trim() || null
    const requestedModelSource = input.modelSource

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

    if (isArchivedTask(task)) {
      throw createTaskError.invalidTaskFollowupState(
        "Archived tasks cannot be used for follow-up.",
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
      const nextModel =
        requestedModel ??
        (requestedModelSource === "runtime-default" ? null : task.model)
      await validateAgentModel(agentType, nextModel)
      const projectSettings =
        await projectSettingsRepository.getProjectSettings(task.projectId)
      const resolvedRuntimePolicy = resolveRuntimePolicy({
        executionMode: input.executionMode ?? task.executionMode,
        runtimePolicy: input.runtimePolicy ?? task.runtimePolicy,
      })
      const runtimePolicy = await applyProjectSkillRuntimePolicy({
        agentType,
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
        displayPrompt: prompt,
        model: nextModel,
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

    if (isArchivedTask(task)) {
      throw createTaskError.invalidTaskBreakState(
        "Archived tasks cannot break the current turn.",
        {
          taskId,
          status: task.status,
        },
      )
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

    if (isArchivedTask(task)) {
      throw createTaskError.invalidTaskRetryState(
        "Archived tasks cannot be retried.",
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
        agentType,
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
          displayPrompt: task.prompt,
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
          agentType,
          prompt: task.prompt,
          projectSettings,
        }),
        displayPrompt: task.prompt,
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

  async function archiveTask(input: ArchiveTaskInput) {
    const taskId = input.taskId.trim()
    if (!taskId) {
      throw createTaskError.invalidTaskId()
    }

    const task = await taskRepository.getTaskById(taskId)
    if (!task) {
      throw createTaskError.taskNotFound(taskId)
    }

    if (!isTerminalTask(task)) {
      throw createTaskError.invalidTaskArchiveState(
        `Only terminal tasks can be archived. Current status: ${task.status}`,
        {
          taskId,
          status: task.status,
        },
      )
    }

    if (isArchivedTask(task)) {
      return task
    }

    try {
      const archivedTask = await taskRepository.archiveTask({
        taskId,
      })

      taskEventBus?.publish({
        type: "task_upsert",
        projectId: archivedTask.projectId,
        task: archivedTask,
      })

      return archivedTask
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.taskArchiveFailed(
        `Failed to archive task: ${String(error)}`,
        error,
      )
    }
  }

  async function deleteTask(input: DeleteTaskInput) {
    const taskId = input.taskId.trim()
    if (!taskId) {
      throw createTaskError.invalidTaskId()
    }

    const task = await taskRepository.getTaskById(taskId)
    if (!task) {
      throw createTaskError.taskNotFound(taskId)
    }

    if (!isTerminalTask(task)) {
      throw createTaskError.invalidTaskDeleteState(
        `Only terminal tasks can be deleted. Current status: ${task.status}`,
        {
          taskId,
          status: task.status,
        },
      )
    }

    try {
      const deletedTask = await taskRepository.deleteTask({
        taskId,
      })

      taskEventBus?.publish({
        type: "task_deleted",
        projectId: deletedTask.projectId,
        taskId: deletedTask.taskId,
      })

      return deletedTask
    } catch (error) {
      if (error instanceof TaskError) {
        throw error
      }

      throw createTaskError.taskDeleteFailed(
        `Failed to delete task: ${String(error)}`,
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
      includeArchived: input.includeArchived,
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
    archiveTask,
    deleteTask,
    updateTaskTitle,
    getTaskDetail,
    getTaskEvents,
    listProjectTasks,
  }
}

export type TaskService = ReturnType<typeof createTaskService>
