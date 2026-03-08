import { ERROR_CODES } from "../../constants/errors"
import type { ExecutorIdConstant } from "../../constants/executors"
import { getProjectById } from "../project/project.repository"
import {
  getTaskById,
  hasActiveTaskInThread,
  listTaskEvents,
  listTasksByProject,
} from "./task.repository"
import {
  cancelCodexTask,
  createAndRunCodexTask,
  followupCodexTask,
} from "./task-runner.service"
import { readTaskConversation } from "./task-conversation.service"
import type { CodexTask } from "./types"

type CreateTaskServiceInput = {
  projectId: string
  prompt: string
  model?: string | null
  executor?: ExecutorIdConstant | string
}

type RetryTaskServiceInput = {
  taskId: string
}

type FollowupTaskServiceInput = {
  taskId: string
  prompt: string
  model?: string | null
}

type CancelTaskServiceInput = {
  taskId: string
  reason?: string
}

type ListProjectTasksInput = {
  projectId: string
  limit?: number
}

type ListTaskEventsInput = {
  taskId: string
  afterSequence?: number
  limit?: number
}

type GetTaskConversationInput = {
  taskId: string
  limit?: number
}

type TaskServiceErrorCode =
  | (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
  | "STORE_READ_ERROR"
  | "STORE_WRITE_ERROR"

export class TaskServiceError extends Error {
  code: TaskServiceErrorCode
  status: number

  constructor(code: TaskServiceErrorCode, message: string, status = 400) {
    super(message)
    this.name = "TaskServiceError"
    this.code = code
    this.status = status
  }
}

function isTerminalTask(task: CodexTask) {
  return (
    task.status === "completed" ||
    task.status === "failed" ||
    task.status === "cancelled"
  )
}

function ensureSupportedExecutor(executor: string) {
  if (executor !== "codex") {
    throw new TaskServiceError(
      ERROR_CODES.UNSUPPORTED_EXECUTOR,
      `Executor is not supported yet: ${executor}`,
      400,
    )
  }
}

export async function createTaskAndRun(input: CreateTaskServiceInput) {
  const projectId = input.projectId.trim()
  const prompt = input.prompt.trim()
  const model = input.model?.trim() || null
  const executor = (input.executor?.trim() || "codex").toLowerCase()

  if (!projectId) {
    throw new TaskServiceError(
      ERROR_CODES.INVALID_PROJECT_ID,
      "Project id is required.",
      400,
    )
  }

  if (!prompt) {
    throw new TaskServiceError(
      ERROR_CODES.INVALID_PROMPT,
      "Prompt cannot be empty.",
      400,
    )
  }

  ensureSupportedExecutor(executor)

  const project = await getProjectById(projectId)
  if (!project) {
    throw new TaskServiceError(
      ERROR_CODES.PROJECT_NOT_FOUND,
      `Project not found: ${projectId}`,
      404,
    )
  }

  try {
    return await createAndRunCodexTask({
      projectId: project.id,
      projectPath: project.path,
      prompt,
      model,
      parentTaskId: null,
    })
  } catch (error) {
    throw new TaskServiceError(
      ERROR_CODES.TASK_START_FAILED,
      `Failed to start Codex task: ${String(error)}`,
      500,
    )
  }
}

export async function followupTask(input: FollowupTaskServiceInput) {
  const taskId = input.taskId.trim()
  const prompt = input.prompt.trim()
  const model = input.model?.trim() || null

  if (!taskId) {
    throw new TaskServiceError(
      ERROR_CODES.INVALID_TASK_ID,
      "Task id is required.",
      400,
    )
  }

  if (!prompt) {
    throw new TaskServiceError(
      ERROR_CODES.INVALID_PROMPT,
      "Prompt cannot be empty.",
      400,
    )
  }

  const task = await getTaskById(taskId)
  if (!task) {
    throw new TaskServiceError(
      ERROR_CODES.TASK_NOT_FOUND,
      `Task not found: ${taskId}`,
      404,
    )
  }

  if (!task.threadId) {
    throw new TaskServiceError(
      ERROR_CODES.INVALID_TASK_FOLLOWUP_STATE,
      "Task thread is not available yet. Wait for the initial run to start.",
      409,
    )
  }

  if (
    await hasActiveTaskInThread({
      threadId: task.threadId,
      excludeTaskId: task.id,
    })
  ) {
    throw new TaskServiceError(
      ERROR_CODES.INVALID_TASK_FOLLOWUP_STATE,
      "Another task is already running on this thread.",
      409,
    )
  }

  try {
    return await followupCodexTask({
      parentTaskId: task.id,
      threadId: task.threadId,
      projectId: task.projectId,
      projectPath: task.projectPath,
      prompt,
      model: model ?? task.model,
    })
  } catch (error) {
    throw new TaskServiceError(
      ERROR_CODES.TASK_FOLLOWUP_FAILED,
      `Failed to create task follow-up: ${String(error)}`,
      500,
    )
  }
}

export async function cancelTask(input: CancelTaskServiceInput) {
  const taskId = input.taskId.trim()
  if (!taskId) {
    throw new TaskServiceError(
      ERROR_CODES.INVALID_TASK_ID,
      "Task id is required.",
      400,
    )
  }

  const task = await getTaskById(taskId)
  if (!task) {
    throw new TaskServiceError(
      ERROR_CODES.TASK_NOT_FOUND,
      `Task not found: ${taskId}`,
      404,
    )
  }

  if (task.status === "queued" || task.status === "running") {
    try {
      return await cancelCodexTask({
        taskId,
        reason: input.reason,
      })
    } catch (error) {
      throw new TaskServiceError(
        ERROR_CODES.TASK_CANCEL_FAILED,
        `Failed to cancel task: ${String(error)}`,
        500,
      )
    }
  }

  return task
}

export async function retryTask(input: RetryTaskServiceInput) {
  const taskId = input.taskId.trim()
  if (!taskId) {
    throw new TaskServiceError(
      ERROR_CODES.INVALID_TASK_ID,
      "Task id is required.",
      400,
    )
  }

  const task = await getTaskById(taskId)
  if (!task) {
    throw new TaskServiceError(
      ERROR_CODES.TASK_NOT_FOUND,
      `Task not found: ${taskId}`,
      404,
    )
  }

  if (task.status !== "failed" && task.status !== "cancelled") {
    throw new TaskServiceError(
      ERROR_CODES.INVALID_TASK_RETRY_STATE,
      `Only failed/cancelled tasks can be retried. Current status: ${task.status}`,
      409,
    )
  }

  try {
    if (task.threadId) {
      if (
        await hasActiveTaskInThread({
          threadId: task.threadId,
          excludeTaskId: task.id,
        })
      ) {
        throw new TaskServiceError(
          ERROR_CODES.INVALID_TASK_RETRY_STATE,
          "Another task is already running on this thread.",
          409,
        )
      }

      return await followupCodexTask({
        parentTaskId: task.id,
        threadId: task.threadId,
        projectId: task.projectId,
        projectPath: task.projectPath,
        prompt: task.prompt,
        model: task.model,
      })
    }

    return await createAndRunCodexTask({
      projectId: task.projectId,
      projectPath: task.projectPath,
      prompt: task.prompt,
      model: task.model,
      parentTaskId: task.id,
    })
  } catch (error) {
    if (error instanceof TaskServiceError) {
      throw error
    }

    throw new TaskServiceError(
      ERROR_CODES.TASK_RETRY_FAILED,
      `Failed to retry task: ${String(error)}`,
      500,
    )
  }
}

export async function getTaskDetail(taskId: string) {
  const normalizedTaskId = taskId.trim()
  if (!normalizedTaskId) {
    throw new TaskServiceError(
      ERROR_CODES.INVALID_TASK_ID,
      "Task id is required.",
      400,
    )
  }

  const task = await getTaskById(normalizedTaskId)
  if (!task) {
    throw new TaskServiceError(
      ERROR_CODES.TASK_NOT_FOUND,
      `Task not found: ${normalizedTaskId}`,
      404,
    )
  }

  return task
}

export async function listProjectTasks(input: ListProjectTasksInput) {
  const projectId = input.projectId.trim()
  if (!projectId) {
    throw new TaskServiceError(
      ERROR_CODES.INVALID_PROJECT_ID,
      "Project id is required.",
      400,
    )
  }

  const project = await getProjectById(projectId)
  if (!project) {
    throw new TaskServiceError(
      ERROR_CODES.PROJECT_NOT_FOUND,
      `Project not found: ${projectId}`,
      404,
    )
  }

  return listTasksByProject({
    projectId,
    limit: input.limit,
  })
}

export async function getTaskEvents(input: ListTaskEventsInput) {
  const task = await getTaskDetail(input.taskId)

  const events = await listTaskEvents({
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

export async function getTaskConversation(input: GetTaskConversationInput) {
  const task = await getTaskDetail(input.taskId)

  try {
    return await readTaskConversation({
      taskId: task.id,
      limit: input.limit,
    })
  } catch (error) {
    throw new TaskServiceError(
      ERROR_CODES.READ_ERROR,
      `Failed to read Codex task conversation: ${String(error)}`,
      500,
    )
  }
}
