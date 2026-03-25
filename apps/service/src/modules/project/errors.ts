export const PROJECT_ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE_PATH: "DUPLICATE_PATH",
  DUPLICATE_SLUG: "DUPLICATE_SLUG",
  INVALID_STATE: "INVALID_STATE",
} as const

export type ProjectErrorCode =
  (typeof PROJECT_ERROR_CODES)[keyof typeof PROJECT_ERROR_CODES]

export class ProjectError extends Error {
  readonly code: ProjectErrorCode

  constructor(code: ProjectErrorCode, message: string) {
    super(message)
    this.name = "ProjectError"
    this.code = code
  }
}

export function createProjectError() {
  return {
    invalidInput(message: string) {
      return new ProjectError(PROJECT_ERROR_CODES.INVALID_INPUT, message)
    },
    notFound(message = "project not found") {
      return new ProjectError(PROJECT_ERROR_CODES.NOT_FOUND, message)
    },
    duplicatePath(message = "project path already exists") {
      return new ProjectError(PROJECT_ERROR_CODES.DUPLICATE_PATH, message)
    },
    duplicateSlug(message = "project slug already exists") {
      return new ProjectError(PROJECT_ERROR_CODES.DUPLICATE_SLUG, message)
    },
    invalidState(message: string) {
      return new ProjectError(PROJECT_ERROR_CODES.INVALID_STATE, message)
    },
  }
}

export function isProjectError(error: unknown): error is ProjectError {
  return error instanceof ProjectError
}
