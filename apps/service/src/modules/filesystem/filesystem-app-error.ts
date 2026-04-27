import { ERROR_CODES } from "../../constants/errors"
import { AppError } from "../../lib/errors/app-error"
import { isProjectError, toProjectAppError } from "../project"
import { FILESYSTEM_ERROR_CODES, isFileSystemError } from "./errors"

export function toFileSystemAppError(error: unknown): AppError {
  if (isProjectError(error)) {
    return toProjectAppError(error)
  }

  if (isFileSystemError(error)) {
    switch (error.code) {
      case FILESYSTEM_ERROR_CODES.INVALID_INPUT:
      case FILESYSTEM_ERROR_CODES.INVALID_CURSOR:
        return new AppError(
          ERROR_CODES.INVALID_REQUEST_BODY,
          400,
          error.message,
        )
      case FILESYSTEM_ERROR_CODES.FILESYSTEM_ROOT_NOT_FOUND:
        return new AppError(
          FILESYSTEM_ERROR_CODES.FILESYSTEM_ROOT_NOT_FOUND,
          404,
          error.message,
        )
      case FILESYSTEM_ERROR_CODES.FILESYSTEM_ROOT_NOT_ALLOWED:
        return new AppError(
          FILESYSTEM_ERROR_CODES.FILESYSTEM_ROOT_NOT_ALLOWED,
          403,
          error.message,
        )
      case FILESYSTEM_ERROR_CODES.BOOTSTRAP_FILESYSTEM_DISABLED:
        return new AppError(
          FILESYSTEM_ERROR_CODES.BOOTSTRAP_FILESYSTEM_DISABLED,
          503,
          error.message,
        )
      case FILESYSTEM_ERROR_CODES.PATH_NOT_FOUND:
        return new AppError(
          FILESYSTEM_ERROR_CODES.PATH_NOT_FOUND,
          404,
          error.message,
        )
      case FILESYSTEM_ERROR_CODES.NOT_A_DIRECTORY:
        return new AppError(
          FILESYSTEM_ERROR_CODES.NOT_A_DIRECTORY,
          400,
          error.message,
        )
      case FILESYSTEM_ERROR_CODES.NOT_A_FILE:
        return new AppError(
          FILESYSTEM_ERROR_CODES.NOT_A_FILE,
          400,
          error.message,
        )
      case FILESYSTEM_ERROR_CODES.PATH_OUTSIDE_ALLOWED_ROOT:
        return new AppError(
          FILESYSTEM_ERROR_CODES.PATH_OUTSIDE_ALLOWED_ROOT,
          403,
          error.message,
        )
      case FILESYSTEM_ERROR_CODES.PERMISSION_DENIED:
        return new AppError(
          FILESYSTEM_ERROR_CODES.PERMISSION_DENIED,
          403,
          error.message,
        )
      case FILESYSTEM_ERROR_CODES.WRITE_FAILED:
        return new AppError(
          FILESYSTEM_ERROR_CODES.WRITE_FAILED,
          500,
          error.message,
        )
      case FILESYSTEM_ERROR_CODES.READ_FAILED:
        return new AppError(
          FILESYSTEM_ERROR_CODES.READ_FAILED,
          500,
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
