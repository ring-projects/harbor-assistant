import { ERROR_CODES } from "../../constants/errors"
import { AppError } from "../../lib/errors/app-error"
import { isProjectError, toProjectAppError } from "../project"
import { GIT_ERROR_CODES, isGitError } from "./errors"

export function toGitAppError(error: unknown): AppError {
  if (isProjectError(error)) {
    return toProjectAppError(error)
  }

  if (isGitError(error)) {
    switch (error.code) {
      case GIT_ERROR_CODES.INVALID_INPUT:
        return new AppError(ERROR_CODES.INVALID_REQUEST_BODY, 400, error.message)
      case GIT_ERROR_CODES.REPOSITORY_NOT_FOUND:
        return new AppError(GIT_ERROR_CODES.REPOSITORY_NOT_FOUND, 404, error.message)
      case GIT_ERROR_CODES.BRANCH_NOT_FOUND:
        return new AppError(GIT_ERROR_CODES.BRANCH_NOT_FOUND, 404, error.message)
      case GIT_ERROR_CODES.BRANCH_ALREADY_EXISTS:
        return new AppError(GIT_ERROR_CODES.BRANCH_ALREADY_EXISTS, 409, error.message)
      case GIT_ERROR_CODES.WORKTREE_DIRTY:
        return new AppError(GIT_ERROR_CODES.WORKTREE_DIRTY, 409, error.message)
      case GIT_ERROR_CODES.NOT_AVAILABLE:
        return new AppError(GIT_ERROR_CODES.NOT_AVAILABLE, 503, error.message)
      case GIT_ERROR_CODES.CHECKOUT_FAILED:
        return new AppError(GIT_ERROR_CODES.CHECKOUT_FAILED, 409, error.message)
      case GIT_ERROR_CODES.CREATE_BRANCH_FAILED:
        return new AppError(GIT_ERROR_CODES.CREATE_BRANCH_FAILED, 409, error.message)
      case GIT_ERROR_CODES.READ_FAILED:
        return new AppError(GIT_ERROR_CODES.READ_FAILED, 500, error.message)
    }
  }

  if (error instanceof AppError) {
    return error
  }

  return new AppError(ERROR_CODES.INTERNAL_ERROR, 500, "Unexpected service error.")
}
