import path from "node:path"

import { createFileSystemError } from "../errors"
import type { ReadTextFileResult } from "../types"
import type { FileSystemRepository } from "./filesystem-repository"
import {
  createDirectoryAtPath,
  readMetadata,
  readTextFileContent,
  resolveCreatablePathInsideRoot,
  toOutputPath,
  toOutputTime,
  writeTextFileAtPath,
} from "./shared"

export async function writeTextFileUseCase(
  repository: FileSystemRepository,
  input: {
    rootPath: string
    path?: string
    content: string
    createParents?: boolean
  },
): Promise<ReadTextFileResult> {
  const content = input.content
  const { canonicalTargetPath, requestedPath } =
    await resolveCreatablePathInsideRoot(repository, input)

  try {
    const existing = await readMetadata(repository, canonicalTargetPath)
    if (existing.kind === "directory") {
      throw createFileSystemError().notAFile(requestedPath)
    }
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as Error & { code?: string }).code === "PATH_NOT_FOUND"
    ) {
      // target does not exist yet, continue
    } else if (error instanceof Error && error.name === "FileSystemError") {
      throw error
    }
  }

  if (input.createParents === true) {
    await createDirectoryAtPath(repository, path.dirname(canonicalTargetPath), {
      recursive: true,
    })
  }

  await writeTextFileAtPath(repository, canonicalTargetPath, content)
  const stats = await readMetadata(repository, canonicalTargetPath)

  if (stats.kind !== "file") {
    throw createFileSystemError().notAFile(requestedPath)
  }

  return {
    path: toOutputPath(canonicalTargetPath),
    content: await readTextFileContent(repository, canonicalTargetPath),
    size: stats.size,
    mtime: toOutputTime(stats.mtime),
  }
}
