export const TASK_ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_EFFORT: "INVALID_EFFORT",
  INVALID_TITLE: "INVALID_TITLE",
  NOT_FOUND: "NOT_FOUND",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  INVALID_CANCEL_STATE: "INVALID_CANCEL_STATE",
  INVALID_ARCHIVE_STATE: "INVALID_ARCHIVE_STATE",
  INVALID_DELETE_STATE: "INVALID_DELETE_STATE",
  INVALID_RESUME_STATE: "INVALID_RESUME_STATE",
  CANCEL_FAILED: "CANCEL_FAILED",
  START_FAILED: "START_FAILED",
  RESUME_FAILED: "RESUME_FAILED",
  UPLOAD_INPUT_IMAGE_FAILED: "UPLOAD_INPUT_IMAGE_FAILED",
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
    invalidEffort(message: string) {
      return new TaskError(TASK_ERROR_CODES.INVALID_EFFORT, message)
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
    invalidCancelState(message: string) {
      return new TaskError(TASK_ERROR_CODES.INVALID_CANCEL_STATE, message)
    },
    invalidArchiveState(message: string) {
      return new TaskError(TASK_ERROR_CODES.INVALID_ARCHIVE_STATE, message)
    },
    invalidDeleteState(message: string) {
      return new TaskError(TASK_ERROR_CODES.INVALID_DELETE_STATE, message)
    },
    invalidResumeState(message: string) {
      return new TaskError(TASK_ERROR_CODES.INVALID_RESUME_STATE, message)
    },
    cancelFailed(message = "task runtime failed to cancel") {
      return new TaskError(TASK_ERROR_CODES.CANCEL_FAILED, message)
    },
    startFailed(message = "task runtime failed to start") {
      return new TaskError(TASK_ERROR_CODES.START_FAILED, message)
    },
    resumeFailed(message = "task runtime failed to resume") {
      return new TaskError(TASK_ERROR_CODES.RESUME_FAILED, message)
    },
    uploadInputImageFailed(message = "task input image upload failed") {
      return new TaskError(TASK_ERROR_CODES.UPLOAD_INPUT_IMAGE_FAILED, message)
    },
  }
}

export function isTaskError(error: unknown): error is TaskError {
  return error instanceof TaskError
}
