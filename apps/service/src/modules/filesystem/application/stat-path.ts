import { createFileSystemError } from "../errors"
import type { FileSystemPathInfo } from "../types"
import type { FileSystemRepository } from "./filesystem-repository"
import {
  readLstatMetadata,
  readMetadata,
  resolvePathInsideRoot,
  toOutputPath,
  toOutputTime,
} from "./shared"

export async function statPathUseCase(
  repository: FileSystemRepository,
  input: {
    rootPath: string
    path?: string
  },
): Promise<FileSystemPathInfo> {
  const { requestedPath, canonicalTargetPath } = await resolvePathInsideRoot(
    repository,
    input,
  )

  const stats = await readMetadata(repository, canonicalTargetPath)
  if (stats.kind !== "file" && stats.kind !== "directory") {
    throw createFileSystemError().readFailed(
      `Unsupported filesystem node type: ${canonicalTargetPath}`,
    )
  }

  const lstat = await readLstatMetadata(repository, requestedPath)

  return {
    path: toOutputPath(canonicalTargetPath),
    type: stats.kind,
    isHidden: canonicalTargetPath.split("/").pop()?.startsWith(".") ?? false,
    isSymlink: lstat?.kind === "symlink",
    size: stats.kind === "file" ? stats.size : null,
    mtime: toOutputTime(stats.mtime),
  }
}
