import { createFileSystemError } from "../errors"
import type { FileSystemPathInfo } from "../types"
import type { FileSystemRepository } from "./filesystem-repository"
import {
  createDirectoryAtPath,
  readLstatMetadata,
  readMetadata,
  resolveCreatablePathInsideRoot,
  toOutputPath,
  toOutputTime,
} from "./shared"

export async function createDirectoryUseCase(
  repository: FileSystemRepository,
  input: {
    rootPath: string
    path?: string
    recursive?: boolean
  },
): Promise<FileSystemPathInfo> {
  const { canonicalTargetPath, requestedPath } =
    await resolveCreatablePathInsideRoot(repository, input)

  await createDirectoryAtPath(repository, canonicalTargetPath, {
    recursive: input.recursive ?? true,
  })

  const stats = await readMetadata(repository, canonicalTargetPath)
  if (stats.kind !== "directory") {
    throw createFileSystemError().notADirectory(requestedPath)
  }

  const lstat = await readLstatMetadata(repository, requestedPath)

  return {
    path: toOutputPath(canonicalTargetPath),
    type: "directory",
    isHidden: canonicalTargetPath.split("/").pop()?.startsWith(".") ?? false,
    isSymlink: lstat?.kind === "symlink",
    size: null,
    mtime: toOutputTime(stats.mtime),
  }
}
