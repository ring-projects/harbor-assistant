import { lstat, readdir, realpath, stat } from "node:fs/promises"
import type { Dirent, Stats } from "node:fs"

export function createFileSystemRepository() {
  async function resolveRealPath(targetPath: string): Promise<string> {
    return realpath(targetPath)
  }

  async function statPath(targetPath: string): Promise<Stats> {
    return stat(targetPath)
  }

  async function lstatPath(targetPath: string): Promise<Stats | null> {
    return lstat(targetPath).catch(() => null)
  }

  async function readDirectory(targetPath: string): Promise<Dirent[]> {
    return readdir(targetPath, { withFileTypes: true })
  }

  return {
    resolveRealPath,
    statPath,
    lstatPath,
    readDirectory,
  }
}

export type FileSystemRepository = ReturnType<typeof createFileSystemRepository>
