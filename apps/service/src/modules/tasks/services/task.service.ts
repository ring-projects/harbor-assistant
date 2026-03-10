import type { ProjectRepository } from "../../project"
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

export type CancelTaskInput = {
  taskId: string
  reason?: string
}

export type ListProjectTasksInput = {
  projectId: string
  limit?: number
}

export type GetTaskTimelineInput = {
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

function ensureSupportedAgent(agentType: string) {
  if (agentType !== "codex") {
    throw createTaskError.unsupportedExecutor(agentType)
  }
}

export function createTaskService(args: {
  projectRepository: Pick<ProjectRepository, "getProjectById">
  taskRepository: Pick<
    TaskRepository,
    "getTaskById" | "hasActiveTaskInThread" | "listTaskTimeline" | "listTasksByProject"
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
    const agentType = (input.agentType?.trim() || "codex").toLowerCase()

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
      return await taskRunnerService.followupTask({
        taskId: task.id,
        threadId: task.threadId,
        projectId: task.projectId,
        projectPath: task.projectPath,
        prompt,
        model: model ?? task.model,
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

  async function cancelTask(input: CancelTaskInput) {
    const taskId = input.taskId.trim()
    if (!taskId) {
      throw createTaskError.invalidTaskId()
    }

    const task = await taskRepository.getTaskById(taskId)
    if (!task) {
      throw createTaskError.taskNotFound(taskId)
    }

    if (task.status === "queued" || task.status === "running") {
      try {
        return await taskRunnerService.cancelTask({
          taskId,
          reason: input.reason,
        })
      } catch (error) {
        if (error instanceof TaskError) {
          throw error
        }

        throw createTaskError.taskCancelFailed(
          `Failed to cancel task: ${String(error)}`,
          error,
        )
      }
    }

    return task
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
        })
      }

      return await taskRunnerService.createAndRunTask({
        projectId: task.projectId,
        projectPath: task.projectPath,
        prompt: task.prompt,
        model: task.model,
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

  async function getTaskTimeline(input: GetTaskTimelineInput) {
    const task = await getTaskDetail(input.taskId)

    const timeline = await taskRepository.listTaskTimeline({
      taskId: task.id,
      afterSequence: input.afterSequence,
      limit: input.limit,
    })

    return {
      task,
      timeline,
      isTerminal: isTerminalTask(task),
    }
  }

  return {
    createTaskAndRun,
    followupTask,
    cancelTask,
    retryTask,
    getTaskDetail,
    getTaskTimeline,
    listProjectTasks,
  }
}

export type TaskService = ReturnType<typeof createTaskService>
