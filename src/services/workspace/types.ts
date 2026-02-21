export type Workspace = {
  id: string
  name: string
  path: string
  createdAt: string
}

export type WorkspaceStoreDocument = {
  version: number
  updatedAt: string
  workspaces: Workspace[]
}

export type WorkspaceErrorCode =
  | "INVALID_PATH"
  | "PATH_NOT_FOUND"
  | "NOT_A_DIRECTORY"
  | "DUPLICATE_PATH"
  | "INVALID_WORKSPACE_ID"
  | "STORE_READ_ERROR"
  | "STORE_WRITE_ERROR"
