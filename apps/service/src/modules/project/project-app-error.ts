import { ERROR_CODES } from "../../constants/errors"
import { AppError } from "../../lib/errors/app-error"
import { PROJECT_ERROR_CODES, isProjectError } from "./errors"

export function toProjectAppError(error: unknown): AppError {
  if (isProjectError(error)) {
    switch (error.code) {
      case PROJECT_ERROR_CODES.NOT_FOUND:
        return new AppError(ERROR_CODES.PROJECT_NOT_FOUND, 404, error.message)
      case PROJECT_ERROR_CODES.DUPLICATE_PATH:
        return new AppError(ERROR_CODES.DUPLICATE_PATH, 409, error.message)
      case PROJECT_ERROR_CODES.DUPLICATE_SLUG:
        return new AppError(ERROR_CODES.DUPLICATE_SLUG, 409, error.message)
      case PROJECT_ERROR_CODES.INVALID_STATE:
        return new AppError(
          ERROR_CODES.INVALID_PROJECT_STATE,
          409,
          error.message,
        )
      case PROJECT_ERROR_CODES.INVALID_INPUT:
        return new AppError(
          ERROR_CODES.INVALID_REQUEST_BODY,
          400,
          error.message,
        )
    }
  }

  if (error instanceof AppError) {
    return error
  }

  return new AppError(
    ERROR_CODES.INTERNAL_ERROR,
    500,
    "Unexpected service error.",
  )
}
