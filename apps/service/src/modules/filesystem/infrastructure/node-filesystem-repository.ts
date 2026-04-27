import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises"

import type {
  FileSystemDirectoryEntry,
  FileSystemMetadata,
  FileSystemNodeKind,
  FileSystemRepository,
} from "../application/filesystem-repository"

function fromStats(stats: {
  isFile(): boolean
  isDirectory(): boolean
  isSymbolicLink(): boolean
  size: number
  mtime: Date
}): FileSystemMetadata {
  let kind: FileSystemNodeKind = "other"

  if (stats.isFile()) {
    kind = "file"
  } else if (stats.isDirectory()) {
    kind = "directory"
  } else if (stats.isSymbolicLink()) {
    kind = "symlink"
  }

  return {
    kind,
    size: kind === "file" ? stats.size : null,
    mtime: stats.mtime,
  }
}

export function createNodeFileSystemRepository(): FileSystemRepository {
  return {
    async resolveRealPath(targetPath: string) {
      return realpath(targetPath)
    },
    async statPath(targetPath: string) {
      return fromStats(await stat(targetPath))
    },
    async lstatPath(targetPath: string) {
      return lstat(targetPath)
        .then((result) => fromStats(result))
        .catch(() => null)
    },
    async readDirectory(targetPath: string) {
      const entries = await readdir(targetPath, { withFileTypes: true })
      return entries.map<FileSystemDirectoryEntry>((entry) => ({
        name: entry.name,
        kind: entry.isDirectory()
          ? "directory"
          : entry.isFile()
            ? "file"
            : entry.isSymbolicLink()
              ? "symlink"
              : "other",
      }))
    },
    async readTextFile(targetPath: string) {
      return readFile(targetPath, "utf8")
    },
    async createDirectory(targetPath: string, options) {
      await mkdir(targetPath, { recursive: options?.recursive ?? true })
    },
    async writeTextFile(targetPath: string, content: string) {
      await writeFile(targetPath, content, "utf8")
    },
  }
}
