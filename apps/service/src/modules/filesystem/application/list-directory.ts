import path from "node:path"

import type { FileSystemListEntry, FileSystemListResult } from "../types"
import { createFileSystemError } from "../errors"
import type { FileSystemRepository } from "./filesystem-repository"
import {
  readDirectoryEntries,
  readLstatMetadata,
  readMetadata,
  resolvePathInsideRoot,
  shouldSkipEntry,
  toListPaging,
  toOutputParentPath,
  toOutputPath,
  toOutputTime,
} from "./shared"

export async function listDirectoryUseCase(
  repository: FileSystemRepository,
  input: {
    rootPath: string
    path?: string
    cursor?: string | null
    limit?: number
    includeHidden?: boolean
  },
): Promise<FileSystemListResult> {
  const { offset, limit } = toListPaging(input)
  const includeHidden = input.includeHidden === true
  const { canonicalRootPath, canonicalTargetPath } = await resolvePathInsideRoot(
    repository,
    input,
  )

  const directoryStats = await readMetadata(repository, canonicalTargetPath)
  if (directoryStats.kind !== "directory") {
    throw createFileSystemError().notADirectory(canonicalTargetPath)
  }

  const entries = await readDirectoryEntries(repository, canonicalTargetPath)
  const mappedEntries = await Promise.all(
    entries.map(async (entry) => {
      if (shouldSkipEntry(entry, includeHidden)) {
        return null
      }

      const entryPath = path.join(canonicalTargetPath, entry.name)
      const lstat = await readLstatMetadata(repository, entryPath)

      const item: FileSystemListEntry = {
        name: entry.name,
        path: toOutputPath(entryPath),
        type: entry.kind === "directory" ? "directory" : "file",
        isHidden: entry.name.startsWith("."),
        isSymlink: lstat?.kind === "symlink",
        size: entry.kind === "file" ? lstat?.size ?? null : null,
        mtime: toOutputTime(lstat?.mtime ?? null),
      }

      return item
    }),
  )

  const sortedEntries = mappedEntries
    .filter((entry): entry is FileSystemListEntry => entry !== null)
    .sort((first, second) => {
      if (first.type !== second.type) {
        return first.type === "directory" ? -1 : 1
      }

      return first.name.localeCompare(second.name, "en")
    })

  if (offset > sortedEntries.length) {
    throw createFileSystemError().invalidCursor(
      "Cursor is out of range for current directory entries.",
    )
  }

  const pagedEntries = sortedEntries.slice(offset, offset + limit)
  const nextOffset = offset + pagedEntries.length
  const nextCursor = nextOffset < sortedEntries.length ? String(nextOffset) : null

  return {
    path: toOutputPath(canonicalTargetPath),
    parentPath: toOutputParentPath(canonicalRootPath, canonicalTargetPath),
    entries: pagedEntries,
    nextCursor,
    truncated: nextCursor !== null,
  }
}
