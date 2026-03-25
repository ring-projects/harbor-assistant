export type FileSystemNodeKind = "file" | "directory" | "symlink" | "other"

export type FileSystemMetadata = {
  kind: FileSystemNodeKind
  size: number | null
  mtime: Date | null
}

export type FileSystemDirectoryEntry = {
  name: string
  kind: FileSystemNodeKind
}

export interface FileSystemRepository {
  resolveRealPath(targetPath: string): Promise<string>
  statPath(targetPath: string): Promise<FileSystemMetadata>
  lstatPath(targetPath: string): Promise<FileSystemMetadata | null>
  readDirectory(targetPath: string): Promise<FileSystemDirectoryEntry[]>
  readTextFile(targetPath: string): Promise<string>
  createDirectory(
    targetPath: string,
    options?: { recursive?: boolean },
  ): Promise<void>
  writeTextFile(targetPath: string, content: string): Promise<void>
}
