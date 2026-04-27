export const FILESYSTEM_ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  PATH_NOT_FOUND: "PATH_NOT_FOUND",
  NOT_A_DIRECTORY: "NOT_A_DIRECTORY",
  NOT_A_FILE: "NOT_A_FILE",
  FILESYSTEM_ROOT_NOT_FOUND: "FILESYSTEM_ROOT_NOT_FOUND",
  FILESYSTEM_ROOT_NOT_ALLOWED: "FILESYSTEM_ROOT_NOT_ALLOWED",
  BOOTSTRAP_FILESYSTEM_DISABLED: "BOOTSTRAP_FILESYSTEM_DISABLED",
  PATH_OUTSIDE_ALLOWED_ROOT: "PATH_OUTSIDE_ALLOWED_ROOT",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  READ_FAILED: "READ_FAILED",
  WRITE_FAILED: "WRITE_FAILED",
  INVALID_CURSOR: "INVALID_CURSOR",
} as const

export type FileSystemErrorCode =
  (typeof FILESYSTEM_ERROR_CODES)[keyof typeof FILESYSTEM_ERROR_CODES]

export class FileSystemError extends Error {
  readonly code: FileSystemErrorCode

  constructor(code: FileSystemErrorCode, message: string) {
    super(message)
    this.name = "FileSystemError"
    this.code = code
  }
}

export function createFileSystemError() {
  return {
    invalidInput(message: string) {
      return new FileSystemError(FILESYSTEM_ERROR_CODES.INVALID_INPUT, message)
    },
    pathNotFound(targetPath: string) {
      return new FileSystemError(
        FILESYSTEM_ERROR_CODES.PATH_NOT_FOUND,
        `Path not found: ${targetPath}`,
      )
    },
    notADirectory(targetPath: string) {
      return new FileSystemError(
        FILESYSTEM_ERROR_CODES.NOT_A_DIRECTORY,
        `Path is not a directory: ${targetPath}`,
      )
    },
    notAFile(targetPath: string) {
      return new FileSystemError(
        FILESYSTEM_ERROR_CODES.NOT_A_FILE,
        `Path is not a file: ${targetPath}`,
      )
    },
    rootNotFound(rootId: string) {
      return new FileSystemError(
        FILESYSTEM_ERROR_CODES.FILESYSTEM_ROOT_NOT_FOUND,
        `Bootstrap filesystem root not found: ${rootId}`,
      )
    },
    rootNotAllowed(rootId: string) {
      return new FileSystemError(
        FILESYSTEM_ERROR_CODES.FILESYSTEM_ROOT_NOT_ALLOWED,
        `Bootstrap filesystem root is not allowed: ${rootId}`,
      )
    },
    bootstrapFilesystemDisabled() {
      return new FileSystemError(
        FILESYSTEM_ERROR_CODES.BOOTSTRAP_FILESYSTEM_DISABLED,
        "Bootstrap filesystem browsing is disabled.",
      )
    },
    pathOutsideAllowedRoot(targetPath: string, rootPath: string) {
      return new FileSystemError(
        FILESYSTEM_ERROR_CODES.PATH_OUTSIDE_ALLOWED_ROOT,
        `Path is outside allowed root: ${targetPath} (root: ${rootPath})`,
      )
    },
    permissionDenied(message: string) {
      return new FileSystemError(
        FILESYSTEM_ERROR_CODES.PERMISSION_DENIED,
        message,
      )
    },
    readFailed(message: string) {
      return new FileSystemError(FILESYSTEM_ERROR_CODES.READ_FAILED, message)
    },
    writeFailed(message: string) {
      return new FileSystemError(FILESYSTEM_ERROR_CODES.WRITE_FAILED, message)
    },
    invalidCursor(message = "Cursor must be a non-negative integer string.") {
      return new FileSystemError(FILESYSTEM_ERROR_CODES.INVALID_CURSOR, message)
    },
  }
}

export function isFileSystemError(error: unknown): error is FileSystemError {
  return error instanceof FileSystemError
}
