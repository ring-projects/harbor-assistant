import { AppError } from "../../lib/errors/app-error"
import { ERROR_CODES } from "../../constants/errors"

export type TaskErrorCode =
  | (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
  | "STORE_READ_ERROR"
  | "STORE_WRITE_ERROR"

export class TaskError extends AppError {}

export const createTaskError = {
  invalidProjectId: (message = "Project id is required.", details?: unknown) =>
    new TaskError(ERROR_CODES.INVALID_PROJECT_ID, 400, message, {
      details,
    }),

  invalidTaskId: (message = "Task id is required.", details?: unknown) =>
    new TaskError(ERROR_CODES.INVALID_TASK_ID, 400, message, {
      details,
    }),

  invalidPrompt: (message = "Prompt cannot be empty.", details?: unknown) =>
    new TaskError(ERROR_CODES.INVALID_PROMPT, 400, message, {
      details,
    }),

  projectNotFound: (projectId: string) =>
    new TaskError(
      ERROR_CODES.PROJECT_NOT_FOUND,
      404,
      `Project not found: ${projectId}`,
      {
        details: { projectId },
      },
    ),

  taskNotFound: (taskId: string) =>
    new TaskError(ERROR_CODES.TASK_NOT_FOUND, 404, `Task not found: ${taskId}`, {
      details: { taskId },
    }),

  unsupportedExecutor: (executor: string) =>
    new TaskError(
      ERROR_CODES.UNSUPPORTED_EXECUTOR,
      400,
      `Agent type is not supported yet: ${executor}`,
      {
        details: { executor },
      },
    ),

  invalidTaskRetryState: (message: string, details?: unknown) =>
    new TaskError(ERROR_CODES.INVALID_TASK_RETRY_STATE, 409, message, {
      details,
    }),

  invalidTaskFollowupState: (message: string, details?: unknown) =>
    new TaskError(ERROR_CODES.INVALID_TASK_FOLLOWUP_STATE, 409, message, {
      details,
    }),

  invalidTaskBreakState: (message: string, details?: unknown) =>
    new TaskError(ERROR_CODES.INVALID_TASK_BREAK_STATE, 409, message, {
      details,
    }),

  taskBreakFailed: (message = "Failed to break current turn.", cause?: unknown) =>
    new TaskError(ERROR_CODES.TASK_BREAK_FAILED, 500, message, {
      details: { cause: String(cause) },
      cause,
    }),

  taskRetryFailed: (message = "Failed to retry task.", cause?: unknown) =>
    new TaskError(ERROR_CODES.TASK_RETRY_FAILED, 500, message, {
      details: { cause: String(cause) },
      cause,
    }),

  taskFollowupFailed: (message = "Failed to create task follow-up.", cause?: unknown) =>
    new TaskError(ERROR_CODES.TASK_FOLLOWUP_FAILED, 500, message, {
      details: { cause: String(cause) },
      cause,
    }),

  taskStartFailed: (message = "Failed to start agent task.", cause?: unknown) =>
    new TaskError(ERROR_CODES.TASK_START_FAILED, 500, message, {
      details: { cause: String(cause) },
      cause,
    }),

  readError: (message = "Failed to read task data.", cause?: unknown) =>
    new TaskError(ERROR_CODES.READ_ERROR, 500, message, {
      details: { cause: String(cause) },
      cause,
    }),

  storeReadError: (operation: string, cause?: unknown) =>
    new TaskError("STORE_READ_ERROR", 500, `Failed to read task store during ${operation}.`, {
      details: { operation },
      cause,
    }),

  storeWriteError: (operation: string, cause?: unknown) =>
    new TaskError("STORE_WRITE_ERROR", 500, `Failed to write task store during ${operation}.`, {
      details: { operation },
      cause,
    }),

  internalError: (message = "Unexpected task service error.", cause?: unknown) =>
    new TaskError(ERROR_CODES.INTERNAL_ERROR, 500, message, {
      details: { cause: String(cause) },
      cause,
    }),
}
