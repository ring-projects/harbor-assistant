import { createFileSystemError } from "../errors"
import type { ReadTextFileResult } from "../types"
import type { FileSystemRepository } from "./filesystem-repository"
import {
  readMetadata,
  readTextFileContent,
  resolvePathInsideRoot,
  toOutputPath,
  toOutputTime,
} from "./shared"

export async function readTextFileUseCase(
  repository: FileSystemRepository,
  input: {
    rootPath: string
    path?: string
  },
): Promise<ReadTextFileResult> {
  const { canonicalTargetPath } = await resolvePathInsideRoot(repository, input)
  const stats = await readMetadata(repository, canonicalTargetPath)

  if (stats.kind !== "file") {
    throw createFileSystemError().notAFile(canonicalTargetPath)
  }

  const content = await readTextFileContent(repository, canonicalTargetPath)

  return {
    path: toOutputPath(canonicalTargetPath),
    content,
    size: stats.size,
    mtime: toOutputTime(stats.mtime),
  }
}
