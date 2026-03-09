import { ERROR_CODES } from "../../constants/errors"
import { AppError } from "../../lib/errors/app-error"

export type FileSystemErrorCode =
  | (typeof ERROR_CODES.INVALID_PATH)
  | (typeof ERROR_CODES.PATH_NOT_FOUND)
  | (typeof ERROR_CODES.NOT_A_DIRECTORY)
  | (typeof ERROR_CODES.PATH_OUTSIDE_ALLOWED_ROOT)
  | (typeof ERROR_CODES.PERMISSION_DENIED)
  | (typeof ERROR_CODES.READ_ERROR)
  | (typeof ERROR_CODES.INVALID_CURSOR)
  | (typeof ERROR_CODES.INTERNAL_ERROR)

export class FileSystemError extends AppError {}

export const createFileSystemError = {
  invalidPath: (
    message = "Requested path is invalid.",
    details?: unknown,
  ) =>
    new FileSystemError(ERROR_CODES.INVALID_PATH, 400, message, {
      details,
    }),

  pathNotFound: (targetPath: string) =>
    new FileSystemError(
      ERROR_CODES.PATH_NOT_FOUND,
      404,
      `Path not found: ${targetPath}`,
      {
        details: { path: targetPath },
      },
    ),

  notADirectory: (targetPath: string) =>
    new FileSystemError(
      ERROR_CODES.NOT_A_DIRECTORY,
      400,
      `Path is not a directory: ${targetPath}`,
      {
        details: { path: targetPath },
      },
    ),

  pathOutsideAllowedRoot: (targetPath: string, allowedRootPath: string) =>
    new FileSystemError(
      ERROR_CODES.PATH_OUTSIDE_ALLOWED_ROOT,
      403,
      "Requested path is outside allowed root.",
      {
        details: {
          path: targetPath,
          allowedRootPath,
        },
      },
    ),

  permissionDenied: (message: string, details?: unknown) =>
    new FileSystemError(ERROR_CODES.PERMISSION_DENIED, 403, message, {
      details,
    }),

  invalidCursor: (
    message = "Cursor must be a non-negative integer string.",
    details?: unknown,
  ) =>
    new FileSystemError(ERROR_CODES.INVALID_CURSOR, 400, message, {
      details,
    }),

  readError: (message: string, cause?: unknown, details?: unknown) =>
    new FileSystemError(ERROR_CODES.READ_ERROR, 500, message, {
      details,
      cause,
    }),

  internalError: (message = "Unexpected filesystem service error.", cause?: unknown) =>
    new FileSystemError(ERROR_CODES.INTERNAL_ERROR, 500, message, {
      cause,
    }),
}
