import type { ProjectRepository } from "../../project"
import { AgentFactory, type AgentType } from "../../../lib/agents"
import { createTaskError, TaskError } from "../errors"
import type { TaskRepository } from "../repositories"
import type { CodexTask } from "../types"
import type { TaskRunnerService } from "./task-runner.service"

export type CreateTaskInput = {
  projectId: string
  prompt: string
  model?: string | null
  agentType?: string
}

export type RetryTaskInput = {
  taskId: string
}

export type FollowupTaskInput = {
  taskId: string
  prompt: string
  model?: string | null
}

export type BreakTaskTurnInput = {
  taskId: string
  reason?: string
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

export function createTaskService(args: {
  projectRepository: Pick<ProjectRepository, "getProjectById">
  taskRepository: Pick<
    TaskRepository,
    | "getTaskById"
    | "hasActiveTaskInThread"
    | "listTaskAgentEvents"
    | "listTasksByProject"
  >
  taskRunnerService: TaskRunnerService
}) {
  const {
    projectRepository,
    taskRepository,
    taskRunnerService,
  } = args

  async function createTaskAndRun(input: CreateTaskInput) {
    const projectId = input.projectId.trim()
    const prompt = input.prompt.trim()
    const model = input.model?.trim() || null
    const agentType = normalizeAgentType(input.agentType)

    if (!projectId) {
      throw createTaskError.invalidProjectId()
    }

    if (!prompt) {
      throw createTaskError.invalidPrompt()
    }

    ensureSupportedAgent(agentType)

    const project = await projectRepository.getProjectById(projectId)
    if (!project) {
      throw createTaskError.projectNotFound(projectId)
    }

    try {
      return await taskRunnerService.createAndRunTask({
        projectId: project.id,
        projectPath: project.path,
        prompt,
        model,
        agentType,
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

      return await taskRunnerService.followupTask({
        taskId: task.id,
        threadId: task.threadId,
        projectId: task.projectId,
        projectPath: task.projectPath,
        prompt,
        model: model ?? task.model,
        agentType,
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
        })
      }

      return await taskRunnerService.createAndRunTask({
        projectId: task.projectId,
        projectPath: task.projectPath,
        prompt: task.prompt,
        model: task.model,
        agentType,
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
    getTaskDetail,
    getTaskEvents,
    listProjectTasks,
  }
}

export type TaskService = ReturnType<typeof createTaskService>
