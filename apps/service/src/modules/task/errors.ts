export const TASK_ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_TITLE: "INVALID_TITLE",
  NOT_FOUND: "NOT_FOUND",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  INVALID_ARCHIVE_STATE: "INVALID_ARCHIVE_STATE",
  INVALID_DELETE_STATE: "INVALID_DELETE_STATE",
  START_FAILED: "START_FAILED",
} as const

export type TaskErrorCode =
  (typeof TASK_ERROR_CODES)[keyof typeof TASK_ERROR_CODES]

export class TaskError extends Error {
  readonly code: TaskErrorCode

  constructor(code: TaskErrorCode, message: string) {
    super(message)
    this.name = "TaskError"
    this.code = code
  }
}

export function createTaskError() {
  return {
    invalidInput(message: string) {
      return new TaskError(TASK_ERROR_CODES.INVALID_INPUT, message)
    },
    invalidTitle(message: string) {
      return new TaskError(TASK_ERROR_CODES.INVALID_TITLE, message)
    },
    notFound(message = "task not found") {
      return new TaskError(TASK_ERROR_CODES.NOT_FOUND, message)
    },
    projectNotFound(message = "project not found") {
      return new TaskError(TASK_ERROR_CODES.PROJECT_NOT_FOUND, message)
    },
    invalidArchiveState(message: string) {
      return new TaskError(TASK_ERROR_CODES.INVALID_ARCHIVE_STATE, message)
    },
    invalidDeleteState(message: string) {
      return new TaskError(TASK_ERROR_CODES.INVALID_DELETE_STATE, message)
    },
    startFailed(message = "task runtime failed to start") {
      return new TaskError(TASK_ERROR_CODES.START_FAILED, message)
    },
  }
}

export function isTaskError(error: unknown): error is TaskError {
  return error instanceof TaskError
}
