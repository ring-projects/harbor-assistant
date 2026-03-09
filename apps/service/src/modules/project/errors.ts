/**
 * Project module error codes
 */
export const PROJECT_ERROR_CODES = {
  // Validation errors (400)
  INVALID_PATH: "INVALID_PATH",
  INVALID_PROJECT_ID: "INVALID_PROJECT_ID",
  INVALID_PROJECT_NAME: "INVALID_PROJECT_NAME",
  INVALID_SLUG: "INVALID_SLUG",
  INVALID_STATUS: "INVALID_STATUS",
  INVALID_SETTINGS: "INVALID_SETTINGS",
  INVALID_MCP_SERVER_NAME: "INVALID_MCP_SERVER_NAME",
  NOT_A_DIRECTORY: "NOT_A_DIRECTORY",

  // Not found errors (404)
  PATH_NOT_FOUND: "PATH_NOT_FOUND",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  PROJECT_SETTINGS_NOT_FOUND: "PROJECT_SETTINGS_NOT_FOUND",
  MCP_SERVER_NOT_FOUND: "MCP_SERVER_NOT_FOUND",

  // Conflict errors (409)
  DUPLICATE_PATH: "DUPLICATE_PATH",
  DUPLICATE_SLUG: "DUPLICATE_SLUG",
  DUPLICATE_MCP_SERVER: "DUPLICATE_MCP_SERVER",
  PROJECT_HAS_ACTIVE_TASKS: "PROJECT_HAS_ACTIVE_TASKS",

  // Permission errors (403)
  PATH_OUTSIDE_ALLOWED_ROOT: "PATH_OUTSIDE_ALLOWED_ROOT",
  PERMISSION_DENIED: "PERMISSION_DENIED",

  // Internal errors (500)
  DB_READ_ERROR: "DB_READ_ERROR",
  DB_WRITE_ERROR: "DB_WRITE_ERROR",
  DB_CONNECTION_ERROR: "DB_CONNECTION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

export type ProjectErrorCode =
  (typeof PROJECT_ERROR_CODES)[keyof typeof PROJECT_ERROR_CODES]

/**
 * Error messages with detailed descriptions
 */
export const PROJECT_ERROR_MESSAGES: Record<ProjectErrorCode, string> = {
  // Validation errors
  INVALID_PATH: "Project path is invalid or empty",
  INVALID_PROJECT_ID: "Project ID is invalid or empty",
  INVALID_PROJECT_NAME: "Project name is invalid or empty",
  INVALID_SLUG: "Project slug is invalid",
  INVALID_STATUS: "Project status is invalid",
  INVALID_SETTINGS: "Project settings are invalid",
  INVALID_MCP_SERVER_NAME: "MCP server name is invalid or empty",
  NOT_A_DIRECTORY: "Path must point to a directory",

  // Not found errors
  PATH_NOT_FOUND: "Project path does not exist",
  PROJECT_NOT_FOUND: "Project not found",
  PROJECT_SETTINGS_NOT_FOUND: "Project settings not found",
  MCP_SERVER_NOT_FOUND: "MCP server configuration not found",

  // Conflict errors
  DUPLICATE_PATH: "A project with this path already exists",
  DUPLICATE_SLUG: "A project with this slug already exists",
  DUPLICATE_MCP_SERVER: "MCP server already configured for this project",
  PROJECT_HAS_ACTIVE_TASKS: "Cannot delete project with active tasks",

  // Permission errors
  PATH_OUTSIDE_ALLOWED_ROOT: "Path is outside the allowed root directory",
  PERMISSION_DENIED: "Permission denied to access this path",

  // Internal errors
  DB_READ_ERROR: "Failed to read from database",
  DB_WRITE_ERROR: "Failed to write to database",
  DB_CONNECTION_ERROR: "Database connection error",
  INTERNAL_ERROR: "Internal server error",
}

/**
 * HTTP status code mapping for error codes
 */
export const PROJECT_ERROR_STATUS_MAP: Record<ProjectErrorCode, number> = {
  // 400 - Bad Request
  INVALID_PATH: 400,
  INVALID_PROJECT_ID: 400,
  INVALID_PROJECT_NAME: 400,
  INVALID_SLUG: 400,
  INVALID_STATUS: 400,
  INVALID_SETTINGS: 400,
  INVALID_MCP_SERVER_NAME: 400,
  NOT_A_DIRECTORY: 400,

  // 404 - Not Found
  PATH_NOT_FOUND: 404,
  PROJECT_NOT_FOUND: 404,
  PROJECT_SETTINGS_NOT_FOUND: 404,
  MCP_SERVER_NOT_FOUND: 404,

  // 409 - Conflict
  DUPLICATE_PATH: 409,
  DUPLICATE_SLUG: 409,
  DUPLICATE_MCP_SERVER: 409,
  PROJECT_HAS_ACTIVE_TASKS: 409,

  // 403 - Forbidden
  PATH_OUTSIDE_ALLOWED_ROOT: 403,
  PERMISSION_DENIED: 403,

  // 500 - Internal Server Error
  DB_READ_ERROR: 500,
  DB_WRITE_ERROR: 500,
  DB_CONNECTION_ERROR: 500,
  INTERNAL_ERROR: 500,
}

/**
 * Base project error class
 */
export class ProjectError extends Error {
  readonly code: ProjectErrorCode
  readonly statusCode: number
  readonly details?: unknown

  constructor(
    code: ProjectErrorCode,
    message?: string,
    details?: unknown,
  ) {
    const errorMessage = message || PROJECT_ERROR_MESSAGES[code]
    super(errorMessage)

    this.name = "ProjectError"
    this.code = code
    this.statusCode = PROJECT_ERROR_STATUS_MAP[code]
    this.details = details

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    }
  }

  /**
   * Check if error is a specific type
   */
  is(code: ProjectErrorCode): boolean {
    return this.code === code
  }

  /**
   * Check if error is a validation error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500
  }
}

/**
 * Repository layer error
 */
export class ProjectRepositoryError extends ProjectError {
  constructor(
    code: ProjectErrorCode,
    message?: string,
    details?: unknown,
  ) {
    super(code, message, details)
    this.name = "ProjectRepositoryError"
  }
}

/**
 * Service layer error
 */
export class ProjectServiceError extends ProjectError {
  constructor(
    code: ProjectErrorCode,
    message?: string,
    details?: unknown,
  ) {
    super(code, message, details)
    this.name = "ProjectServiceError"
  }
}

/**
 * Validation error
 */
export class ProjectValidationError extends ProjectError {
  readonly field?: string

  constructor(
    code: ProjectErrorCode,
    message?: string,
    field?: string,
    details?: unknown,
  ) {
    super(code, message, details)
    this.name = "ProjectValidationError"
    this.field = field
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        field: this.field,
        details: this.details,
      },
    }
  }
}

/**
 * Helper functions to create specific errors
 */
export const createProjectError = {
  /**
   * Validation errors
   */
  invalidPath: (message?: string, details?: unknown) =>
    new ProjectValidationError(
      PROJECT_ERROR_CODES.INVALID_PATH,
      message,
      "path",
      details,
    ),

  invalidProjectId: (message?: string, details?: unknown) =>
    new ProjectValidationError(
      PROJECT_ERROR_CODES.INVALID_PROJECT_ID,
      message,
      "id",
      details,
    ),

  invalidProjectName: (message?: string, details?: unknown) =>
    new ProjectValidationError(
      PROJECT_ERROR_CODES.INVALID_PROJECT_NAME,
      message,
      "name",
      details,
    ),

  notADirectory: (path: string) =>
    new ProjectValidationError(
      PROJECT_ERROR_CODES.NOT_A_DIRECTORY,
      `Path must point to a directory: ${path}`,
      "path",
      { path },
    ),

  /**
   * Not found errors
   */
  pathNotFound: (path: string) =>
    new ProjectError(
      PROJECT_ERROR_CODES.PATH_NOT_FOUND,
      `Project path does not exist: ${path}`,
      { path },
    ),

  projectNotFound: (id: string) =>
    new ProjectError(
      PROJECT_ERROR_CODES.PROJECT_NOT_FOUND,
      `Project not found: ${id}`,
      { projectId: id },
    ),

  settingsNotFound: (projectId: string) =>
    new ProjectError(
      PROJECT_ERROR_CODES.PROJECT_SETTINGS_NOT_FOUND,
      `Project settings not found: ${projectId}`,
      { projectId },
    ),

  mcpServerNotFound: (projectId: string, serverName: string) =>
    new ProjectError(
      PROJECT_ERROR_CODES.MCP_SERVER_NOT_FOUND,
      `MCP server not found: ${serverName}`,
      { projectId, serverName },
    ),

  /**
   * Conflict errors
   */
  duplicatePath: (path: string) =>
    new ProjectError(
      PROJECT_ERROR_CODES.DUPLICATE_PATH,
      `A project with this path already exists: ${path}`,
      { path },
    ),

  duplicateSlug: (slug: string) =>
    new ProjectError(
      PROJECT_ERROR_CODES.DUPLICATE_SLUG,
      `A project with this slug already exists: ${slug}`,
      { slug },
    ),

  projectHasActiveTasks: (projectId: string, taskCount: number) =>
    new ProjectError(
      PROJECT_ERROR_CODES.PROJECT_HAS_ACTIVE_TASKS,
      `Cannot delete project with ${taskCount} active task(s)`,
      { projectId, taskCount },
    ),

  /**
   * Database errors
   */
  dbReadError: (operation: string, cause?: unknown) =>
    new ProjectRepositoryError(
      PROJECT_ERROR_CODES.DB_READ_ERROR,
      `Database read error during ${operation}`,
      { operation, cause: String(cause) },
    ),

  dbWriteError: (operation: string, cause?: unknown) =>
    new ProjectRepositoryError(
      PROJECT_ERROR_CODES.DB_WRITE_ERROR,
      `Database write error during ${operation}`,
      { operation, cause: String(cause) },
    ),

  /**
   * Internal errors
   */
  internalError: (message: string, cause?: unknown) =>
    new ProjectError(
      PROJECT_ERROR_CODES.INTERNAL_ERROR,
      message,
      { cause: String(cause) },
    ),
}

/**
 * Type guard to check if error is a ProjectError
 */
export function isProjectError(error: unknown): error is ProjectError {
  return error instanceof ProjectError
}

/**
 * Type guard to check if error is a ProjectRepositoryError
 */
export function isProjectRepositoryError(
  error: unknown,
): error is ProjectRepositoryError {
  return error instanceof ProjectRepositoryError
}

/**
 * Type guard to check if error is a ProjectServiceError
 */
export function isProjectServiceError(
  error: unknown,
): error is ProjectServiceError {
  return error instanceof ProjectServiceError
}

/**
 * Type guard to check if error is a ProjectValidationError
 */
export function isProjectValidationError(
  error: unknown,
): error is ProjectValidationError {
  return error instanceof ProjectValidationError
}
