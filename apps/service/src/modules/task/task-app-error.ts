import { ERROR_CODES } from "../../constants/errors"
import { AppError } from "../../lib/errors/app-error"
import { TASK_ERROR_CODES, isTaskError } from "./errors"

export function toTaskAppError(error: unknown): AppError {
  if (isTaskError(error)) {
    switch (error.code) {
      case TASK_ERROR_CODES.NOT_FOUND:
        return new AppError(ERROR_CODES.TASK_NOT_FOUND, 404, error.message)
      case TASK_ERROR_CODES.PROJECT_NOT_FOUND:
        return new AppError(ERROR_CODES.PROJECT_NOT_FOUND, 404, error.message)
      case TASK_ERROR_CODES.INVALID_TITLE:
        return new AppError(ERROR_CODES.INVALID_TASK_TITLE, 400, error.message)
      case TASK_ERROR_CODES.INVALID_ARCHIVE_STATE:
        return new AppError(
          ERROR_CODES.INVALID_TASK_ARCHIVE_STATE,
          409,
          error.message,
        )
      case TASK_ERROR_CODES.INVALID_DELETE_STATE:
        return new AppError(
          ERROR_CODES.INVALID_TASK_DELETE_STATE,
          409,
          error.message,
        )
      case TASK_ERROR_CODES.INVALID_INPUT:
        return new AppError(ERROR_CODES.INVALID_REQUEST_BODY, 400, error.message)
      case TASK_ERROR_CODES.START_FAILED:
        return new AppError(ERROR_CODES.TASK_START_FAILED, 500, error.message)
    }
  }

  if (error instanceof AppError) {
    return error
  }

  return new AppError(ERROR_CODES.INTERNAL_ERROR, 500, "Unexpected service error.")
}
