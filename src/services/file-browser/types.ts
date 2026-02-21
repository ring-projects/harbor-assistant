export type FileNodeType = "directory" | "file" | "symlink" | "other"

export type FileTreeNode = {
  name: string
  path: string
  type: FileNodeType
  size?: number
  mtime?: string
  children?: FileTreeNode[]
  truncated?: boolean
}

export type BrowseDirectoryInput = {
  path?: string
  depth?: number
  includeHidden?: boolean
  maxEntriesPerDirectory?: number
  maxNodes?: number
}

export type BrowseDirectoryMeta = {
  depth: number
  truncated: boolean
  nodesVisited: number
  root: string
}

export type BrowseDirectoryResult = {
  tree: FileTreeNode
  meta: BrowseDirectoryMeta
}

export type FileBrowserErrorCode =
  | "INVALID_PATH"
  | "PATH_OUT_OF_ROOT"
  | "PATH_NOT_FOUND"
  | "NOT_A_DIRECTORY"
  | "READ_ERROR"
