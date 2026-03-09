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
