import { ERROR_CODES } from "../../constants/errors"
import { AppError } from "../../lib/errors/app-error"
import { isSandboxError, SANDBOX_ERROR_CODES } from "./errors"

export function toSandboxAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (isSandboxError(error)) {
    switch (error.code) {
      case SANDBOX_ERROR_CODES.NOT_FOUND:
        return new AppError(ERROR_CODES.NOT_FOUND, 404, error.message)
      case SANDBOX_ERROR_CODES.INVALID_INPUT:
        return new AppError(
          ERROR_CODES.INVALID_REQUEST_BODY,
          400,
          error.message,
        )
      case SANDBOX_ERROR_CODES.PROVIDER_ERROR:
        return new AppError(ERROR_CODES.INTERNAL_ERROR, 500, error.message)
    }
  }

  return new AppError(
    ERROR_CODES.INTERNAL_ERROR,
    500,
    "Unexpected service error.",
  )
}
