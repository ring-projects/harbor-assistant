import { AppError } from "../../lib/errors/app-error"
import { ERROR_CODES } from "../../constants/errors"

export type GitErrorCode =
  | (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
  | "GIT_REPOSITORY_NOT_FOUND"
  | "GIT_BRANCH_NOT_FOUND"
  | "GIT_BRANCH_ALREADY_EXISTS"
  | "GIT_WORKTREE_DIRTY"
  | "GIT_NOT_AVAILABLE"
  | "GIT_READ_FAILED"
  | "GIT_CHECKOUT_FAILED"
  | "GIT_CREATE_BRANCH_FAILED"

export class GitError extends AppError {}

export const createGitError = {
  invalidProjectId: (message = "Project id is required.", details?: unknown) =>
    new GitError(ERROR_CODES.INVALID_PROJECT_ID, 400, message, {
      details,
    }),

  invalidBranchName: (message = "Branch name is invalid.", details?: unknown) =>
    new GitError(ERROR_CODES.INVALID_BRANCH_NAME, 400, message, {
      details,
    }),

  projectNotFound: (projectId: string) =>
    new GitError(
      ERROR_CODES.PROJECT_NOT_FOUND,
      404,
      `Project not found: ${projectId}`,
      {
        details: { projectId },
      },
    ),

  repositoryNotFound: (projectPath: string, details?: unknown) =>
    new GitError(
      "GIT_REPOSITORY_NOT_FOUND",
      404,
      `Path is not inside a git repository: ${projectPath}`,
      {
        details: {
          projectPath,
          ...((typeof details === "object" && details !== null) ? details : {}),
        },
      },
    ),

  branchNotFound: (branchName: string, details?: unknown) =>
    new GitError(
      "GIT_BRANCH_NOT_FOUND",
      404,
      `Git branch not found: ${branchName}`,
      {
        details: {
          branchName,
          ...((typeof details === "object" && details !== null) ? details : {}),
        },
      },
    ),

  branchAlreadyExists: (branchName: string, details?: unknown) =>
    new GitError(
      "GIT_BRANCH_ALREADY_EXISTS",
      409,
      `Git branch already exists: ${branchName}`,
      {
        details: {
          branchName,
          ...((typeof details === "object" && details !== null) ? details : {}),
        },
      },
    ),

  worktreeDirty: (message: string, details?: unknown) =>
    new GitError("GIT_WORKTREE_DIRTY", 409, message, {
      details,
    }),

  gitNotAvailable: (message = "Git executable is not available.", details?: unknown) =>
    new GitError("GIT_NOT_AVAILABLE", 500, message, {
      details,
    }),

  readFailed: (message = "Failed to read git repository.", cause?: unknown) =>
    new GitError("GIT_READ_FAILED", 500, message, {
      details: { cause: String(cause) },
      cause,
    }),

  checkoutFailed: (message = "Failed to checkout branch.", cause?: unknown) =>
    new GitError("GIT_CHECKOUT_FAILED", 409, message, {
      details: { cause: String(cause) },
      cause,
    }),

  createBranchFailed: (message = "Failed to create branch.", cause?: unknown) =>
    new GitError("GIT_CREATE_BRANCH_FAILED", 409, message, {
      details: { cause: String(cause) },
      cause,
    }),
}
