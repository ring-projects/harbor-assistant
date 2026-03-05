export type Project = {
  id: string
  name: string
  path: string
  createdAt: string
}

export type ProjectErrorCode =
  | "INVALID_PATH"
  | "PATH_NOT_FOUND"
  | "NOT_A_DIRECTORY"
  | "DUPLICATE_PATH"
  | "INVALID_PROJECT_ID"
  | "DB_READ_ERROR"
  | "DB_WRITE_ERROR"
