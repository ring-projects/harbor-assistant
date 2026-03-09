import { AppError } from "../../lib/errors/app-error"

export type ProjectErrorCode =
  | "INVALID_PATH"
  | "INVALID_PROJECT_ID"
  | "INVALID_PROJECT_NAME"
  | "INVALID_SLUG"
  | "INVALID_STATUS"
  | "INVALID_SETTINGS"
  | "INVALID_MCP_SERVER_NAME"
  | "NOT_A_DIRECTORY"
  | "PATH_NOT_FOUND"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_SETTINGS_NOT_FOUND"
  | "MCP_SERVER_NOT_FOUND"
  | "DUPLICATE_PATH"
  | "DUPLICATE_SLUG"
  | "DUPLICATE_MCP_SERVER"
  | "PROJECT_HAS_ACTIVE_TASKS"
  | "PATH_OUTSIDE_ALLOWED_ROOT"
  | "PERMISSION_DENIED"
  | "DB_READ_ERROR"
  | "DB_WRITE_ERROR"
  | "DB_CONNECTION_ERROR"
  | "INTERNAL_ERROR"

type ProjectErrorOptions = {
  details?: unknown
  field?: string
  cause?: unknown
}

export class ProjectError extends AppError {
  readonly field?: string

  constructor(
    code: ProjectErrorCode,
    statusCode: number,
    message: string,
    options?: ProjectErrorOptions,
  ) {
    super(code, statusCode, message, {
      details: options?.details,
      cause: options?.cause,
    })

    this.field = options?.field
  }
}

export const createProjectError = {
  invalidPath: (
    message = "Project path is invalid or empty",
    details?: unknown,
  ) =>
    new ProjectError("INVALID_PATH", 400, message, {
      field: "path",
      details,
    }),

  invalidProjectId: (
    message = "Project ID is invalid or empty",
    details?: unknown,
  ) =>
    new ProjectError("INVALID_PROJECT_ID", 400, message, {
      field: "id",
      details,
    }),

  invalidProjectName: (
    message = "Project name is invalid or empty",
    details?: unknown,
  ) =>
    new ProjectError("INVALID_PROJECT_NAME", 400, message, {
      field: "name",
      details,
    }),

  invalidMcpServerName: (
    message = "MCP server name is invalid or empty",
    details?: unknown,
  ) =>
    new ProjectError("INVALID_MCP_SERVER_NAME", 400, message, {
      field: "serverName",
      details,
    }),

  notADirectory: (path: string) =>
    new ProjectError("NOT_A_DIRECTORY", 400, `Path must point to a directory: ${path}`, {
      field: "path",
      details: { path },
    }),

  pathNotFound: (path: string) =>
    new ProjectError("PATH_NOT_FOUND", 404, `Project path does not exist: ${path}`, {
      details: { path },
    }),

  projectNotFound: (id: string) =>
    new ProjectError("PROJECT_NOT_FOUND", 404, `Project not found: ${id}`, {
      details: { projectId: id },
    }),

  settingsNotFound: (projectId: string) =>
    new ProjectError(
      "PROJECT_SETTINGS_NOT_FOUND",
      404,
      `Project settings not found: ${projectId}`,
      {
        details: { projectId },
      },
    ),

  mcpServerNotFound: (projectId: string, serverName: string) =>
    new ProjectError("MCP_SERVER_NOT_FOUND", 404, `MCP server not found: ${serverName}`, {
      details: { projectId, serverName },
    }),

  duplicatePath: (path: string) =>
    new ProjectError("DUPLICATE_PATH", 409, `A project with this path already exists: ${path}`, {
      details: { path },
    }),

  duplicateSlug: (slug: string) =>
    new ProjectError("DUPLICATE_SLUG", 409, `A project with this slug already exists: ${slug}`, {
      details: { slug },
    }),

  projectHasActiveTasks: (projectId: string, taskCount: number) =>
    new ProjectError(
      "PROJECT_HAS_ACTIVE_TASKS",
      409,
      `Cannot delete project with ${taskCount} active task(s)`,
      {
        details: { projectId, taskCount },
      },
    ),

  pathOutsideAllowedRoot: (path: string) =>
    new ProjectError(
      "PATH_OUTSIDE_ALLOWED_ROOT",
      403,
      "Path is outside the allowed root directory",
      {
        field: "path",
        details: { path },
      },
    ),

  permissionDenied: (path: string) =>
    new ProjectError("PERMISSION_DENIED", 403, "Permission denied to access this path", {
      field: "path",
      details: { path },
    }),

  dbReadError: (operation: string, cause?: unknown) =>
    new ProjectError("DB_READ_ERROR", 500, `Database read error during ${operation}`, {
      details: { operation },
      cause,
    }),

  dbWriteError: (operation: string, cause?: unknown) =>
    new ProjectError("DB_WRITE_ERROR", 500, `Database write error during ${operation}`, {
      details: { operation },
      cause,
    }),

  dbConnectionError: (message = "Database connection error", cause?: unknown) =>
    new ProjectError("DB_CONNECTION_ERROR", 500, message, { cause }),

  internalError: (message = "Internal server error", cause?: unknown) =>
    new ProjectError("INTERNAL_ERROR", 500, message, { cause }),
}
