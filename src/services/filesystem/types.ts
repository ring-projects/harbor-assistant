export type FileSystemEntryType = "directory" | "file"

export type FileSystemListEntry = {
  name: string
  path: string
  type: FileSystemEntryType
  isHidden: boolean
  isSymlink: boolean
  size: number | null
  mtime: string | null
}

export type FileSystemListResult = {
  path: string
  parentPath: string | null
  entries: FileSystemListEntry[]
  nextCursor: string | null
  truncated: boolean
}

export type FileSystemErrorCode =
  | "INVALID_PATH"
  | "PATH_NOT_FOUND"
  | "NOT_A_DIRECTORY"
  | "PATH_OUTSIDE_ALLOWED_ROOT"
  | "PERMISSION_DENIED"
  | "READ_ERROR"
  | "INVALID_CURSOR"

export class FileSystemServiceError extends Error {
  code: FileSystemErrorCode

  constructor(code: FileSystemErrorCode, message: string) {
    super(message)
    this.name = "FileSystemServiceError"
    this.code = code
  }
}
