import { ERROR_CODES } from "../../constants/errors"
import { AppError } from "../../lib/errors/app-error"
import { isProjectError } from "../project/errors"
import { toProjectAppError } from "../project/project-app-error"
import { isTaskError } from "../task/errors"
import { toTaskAppError } from "../task/task-app-error"
import {
  ORCHESTRATION_ERROR_CODES,
  isOrchestrationError,
} from "./errors"

export function toOrchestrationAppError(error: unknown): AppError {
  if (isOrchestrationError(error)) {
    switch (error.code) {
      case ORCHESTRATION_ERROR_CODES.NOT_FOUND:
        return new AppError(
          ERROR_CODES.ORCHESTRATION_NOT_FOUND,
          404,
          error.message,
        )
      case ORCHESTRATION_ERROR_CODES.INVALID_STATE:
        return new AppError(
          ERROR_CODES.INVALID_ORCHESTRATION_STATE,
          409,
          error.message,
        )
      case ORCHESTRATION_ERROR_CODES.INVALID_INPUT:
        return new AppError(ERROR_CODES.INVALID_REQUEST_BODY, 400, error.message)
    }
  }

  if (isProjectError(error)) {
    return toProjectAppError(error)
  }

  if (isTaskError(error)) {
    return toTaskAppError(error)
  }

  if (error instanceof AppError) {
    return error
  }

  return new AppError(ERROR_CODES.INTERNAL_ERROR, 500, "Unexpected service error.")
}
