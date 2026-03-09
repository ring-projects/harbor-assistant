import { ERROR_CODES } from "../../constants/errors"
import { AppError, isAppError } from "./app-error"

type ErrorResponse = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
    requestId?: string
  }
}

function isValidationError(error: unknown): error is {
  statusCode?: number
  validation?: unknown
  validationContext?: string
  message: string
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "validation" in error &&
    "message" in error
  )
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error
  }

  if (isValidationError(error)) {
    return new AppError(
      ERROR_CODES.INVALID_REQUEST_BODY,
      typeof error.statusCode === "number" ? error.statusCode : 400,
      error.message,
      {
        details: {
          validation: error.validation,
          validationContext: error.validationContext,
        },
        cause: error,
      },
    )
  }

  if (error instanceof Error) {
    return new AppError(
      ERROR_CODES.INTERNAL_ERROR,
      500,
      "Unexpected service error.",
      { cause: error },
    )
  }

  return new AppError(
    ERROR_CODES.INTERNAL_ERROR,
    500,
    "Unexpected service error.",
  )
}

export function toErrorResponse(
  error: unknown,
  requestId?: string,
): ErrorResponse {
  const appError = toAppError(error)

  return {
    ok: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  }
}
