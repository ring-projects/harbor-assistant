export const WORKSPACE_ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE_SLUG: "DUPLICATE_SLUG",
  INVALID_STATE: "INVALID_STATE",
} as const

export type WorkspaceErrorCode =
  (typeof WORKSPACE_ERROR_CODES)[keyof typeof WORKSPACE_ERROR_CODES]

export class WorkspaceError extends Error {
  readonly code: WorkspaceErrorCode

  constructor(code: WorkspaceErrorCode, message: string) {
    super(message)
    this.name = "WorkspaceError"
    this.code = code
  }
}

export function createWorkspaceError() {
  return {
    invalidInput(message: string) {
      return new WorkspaceError(WORKSPACE_ERROR_CODES.INVALID_INPUT, message)
    },
    notFound(message = "workspace not found") {
      return new WorkspaceError(WORKSPACE_ERROR_CODES.NOT_FOUND, message)
    },
    duplicateSlug(message = "workspace slug already exists") {
      return new WorkspaceError(WORKSPACE_ERROR_CODES.DUPLICATE_SLUG, message)
    },
    invalidState(message: string) {
      return new WorkspaceError(WORKSPACE_ERROR_CODES.INVALID_STATE, message)
    },
  }
}

export function isWorkspaceError(error: unknown): error is WorkspaceError {
  return error instanceof WorkspaceError
}
