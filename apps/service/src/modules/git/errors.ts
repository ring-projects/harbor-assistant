export const GIT_ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  REPOSITORY_NOT_FOUND: "GIT_REPOSITORY_NOT_FOUND",
  BRANCH_NOT_FOUND: "GIT_BRANCH_NOT_FOUND",
  BRANCH_ALREADY_EXISTS: "GIT_BRANCH_ALREADY_EXISTS",
  WORKTREE_DIRTY: "GIT_WORKTREE_DIRTY",
  NOT_AVAILABLE: "GIT_NOT_AVAILABLE",
  READ_FAILED: "GIT_READ_FAILED",
  CHECKOUT_FAILED: "GIT_CHECKOUT_FAILED",
  CREATE_BRANCH_FAILED: "GIT_CREATE_BRANCH_FAILED",
} as const

export type GitErrorCode =
  (typeof GIT_ERROR_CODES)[keyof typeof GIT_ERROR_CODES]

export class GitError extends Error {
  readonly code: GitErrorCode

  constructor(code: GitErrorCode, message: string) {
    super(message)
    this.name = "GitError"
    this.code = code
  }
}

export function createGitError() {
  return {
    invalidInput(message: string) {
      return new GitError(GIT_ERROR_CODES.INVALID_INPUT, message)
    },
    repositoryNotFound(path: string) {
      return new GitError(
        GIT_ERROR_CODES.REPOSITORY_NOT_FOUND,
        `Path is not inside a git repository: ${path}`,
      )
    },
    branchNotFound(branchName: string) {
      return new GitError(
        GIT_ERROR_CODES.BRANCH_NOT_FOUND,
        `Git branch not found: ${branchName}`,
      )
    },
    branchAlreadyExists(branchName: string) {
      return new GitError(
        GIT_ERROR_CODES.BRANCH_ALREADY_EXISTS,
        `Git branch already exists: ${branchName}`,
      )
    },
    worktreeDirty(message = "Git worktree has uncommitted changes.") {
      return new GitError(GIT_ERROR_CODES.WORKTREE_DIRTY, message)
    },
    notAvailable(message = "Git executable is not available.") {
      return new GitError(GIT_ERROR_CODES.NOT_AVAILABLE, message)
    },
    readFailed(message = "Failed to read git repository.") {
      return new GitError(GIT_ERROR_CODES.READ_FAILED, message)
    },
    checkoutFailed(message = "Failed to checkout branch.") {
      return new GitError(GIT_ERROR_CODES.CHECKOUT_FAILED, message)
    },
    createBranchFailed(message = "Failed to create branch.") {
      return new GitError(GIT_ERROR_CODES.CREATE_BRANCH_FAILED, message)
    },
  }
}

export function isGitError(error: unknown): error is GitError {
  return error instanceof GitError
}
