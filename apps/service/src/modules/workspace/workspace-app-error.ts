import { ERROR_CODES } from "../../constants/errors"
import { AppError } from "../../lib/errors/app-error"
import { WORKSPACE_ERROR_CODES, isWorkspaceError } from "./errors"

export function toWorkspaceAppError(error: unknown): AppError {
  if (isWorkspaceError(error)) {
    switch (error.code) {
      case WORKSPACE_ERROR_CODES.NOT_FOUND:
        return new AppError(ERROR_CODES.NOT_FOUND, 404, error.message)
      case WORKSPACE_ERROR_CODES.DUPLICATE_SLUG:
        return new AppError(ERROR_CODES.CONFLICT, 409, error.message)
      case WORKSPACE_ERROR_CODES.INVALID_STATE:
        return new AppError(
          ERROR_CODES.INVALID_WORKSPACE_STATE,
          409,
          error.message,
        )
      case WORKSPACE_ERROR_CODES.INVALID_INPUT:
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
