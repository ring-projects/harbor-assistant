import path from "node:path"

import {
  FS_DEFAULT_LIST_LIMIT,
  FS_IGNORED_DIRECTORY_NAMES,
  FS_MAX_LIST_LIMIT,
} from "../../../constants/fs"
import { createFileSystemError, FileSystemError } from "../errors"
import type {
  FileSystemListEntry,
  FileSystemListResult,
} from "../types"
import type { FileSystemRepository } from "../repositories"

export type ListDirectoryInput = {
  path?: string
  cursor?: string | null
  limit?: number
  includeHidden?: boolean
}

function normalizePathSeparators(value: string) {
  if (path.sep === "/") {
    return value
  }

  return value.split(path.sep).join("/")
}

function isPathInsideRoot(rootPath: string, absolutePath: string) {
  const relative = path.relative(rootPath, absolutePath)
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  )
}

function resolveRequestedPath(allowedRootPath: string, requestedPath?: string) {
  const value = requestedPath?.trim()
  if (!value) {
    return allowedRootPath
  }

  return path.isAbsolute(value)
    ? path.resolve(value)
    : path.resolve(allowedRootPath, value)
}

function parseCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return 0
  }

  const offset = Number(cursor)
  if (!Number.isInteger(offset) || offset < 0) {
    throw createFileSystemError.invalidCursor()
  }

  return offset
}

function normalizeLimit(limit: number | undefined) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return FS_DEFAULT_LIST_LIMIT
  }

  return Math.min(FS_MAX_LIST_LIMIT, Math.max(1, Math.trunc(limit)))
}

function isPermissionError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: string }).code === "EACCES" ||
      (error as { code?: string }).code === "EPERM")
  )
}

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  )
}

function toIsoTime(value: Date | null) {
  if (!value) {
    return null
  }

  return Number.isNaN(value.getTime()) ? null : value.toISOString()
}

export function createFileSystemService(args: {
  fileSystemRepository: FileSystemRepository
  rootDirectory: string
}) {
  const { fileSystemRepository, rootDirectory } = args

  async function resolveAllowedRootPath() {
    const absolute = path.resolve(rootDirectory)
    const canonical = await fileSystemRepository
      .resolveRealPath(absolute)
      .catch(() => absolute)

    const stats = await fileSystemRepository.statPath(canonical).catch((error) => {
      throw createFileSystemError.readError(
        `Failed to read configured file browser root: ${String(error)}`,
        error,
        { path: canonical },
      )
    })

    if (!stats.isDirectory()) {
      throw createFileSystemError.notADirectory(canonical)
    }

    return canonical
  }

  async function listDirectory(
    input: ListDirectoryInput,
  ): Promise<FileSystemListResult> {
    const allowedRootPath = await resolveAllowedRootPath()
    const requestedPath = resolveRequestedPath(allowedRootPath, input.path)
    const offset = parseCursor(input.cursor)
    const limit = normalizeLimit(input.limit)
    const includeHidden = input.includeHidden === true

    try {
      const canonicalPath = await fileSystemRepository
        .resolveRealPath(requestedPath)
        .catch((error) => {
          if (isNotFoundError(error)) {
            throw createFileSystemError.pathNotFound(requestedPath)
          }

          if (isPermissionError(error)) {
            throw createFileSystemError.permissionDenied(
              `Permission denied while resolving path: ${requestedPath}`,
              { path: requestedPath },
            )
          }

          throw createFileSystemError.readError(
            `Failed to resolve path: ${requestedPath}. ${String(error)}`,
            error,
            { path: requestedPath },
          )
        })

      if (!isPathInsideRoot(allowedRootPath, canonicalPath)) {
        throw createFileSystemError.pathOutsideAllowedRoot(
          canonicalPath,
          allowedRootPath,
        )
      }

      const directoryStats = await fileSystemRepository
        .statPath(canonicalPath)
        .catch((error) => {
          if (isPermissionError(error)) {
            throw createFileSystemError.permissionDenied(
              `Permission denied while reading path: ${canonicalPath}`,
              { path: canonicalPath },
            )
          }

          throw createFileSystemError.readError(
            `Failed to stat path: ${canonicalPath}. ${String(error)}`,
            error,
            { path: canonicalPath },
          )
        })

      if (!directoryStats.isDirectory()) {
        throw createFileSystemError.notADirectory(canonicalPath)
      }

      const entries = await fileSystemRepository
        .readDirectory(canonicalPath)
        .catch((error) => {
          if (isPermissionError(error)) {
            throw createFileSystemError.permissionDenied(
              `Permission denied while listing directory: ${canonicalPath}`,
              { path: canonicalPath },
            )
          }

          throw createFileSystemError.readError(
            `Failed to list directory: ${canonicalPath}. ${String(error)}`,
            error,
            { path: canonicalPath },
          )
        })

      const mappedEntries = await Promise.all(
        entries.map(async (entry) => {
          const name = entry.name
          const isHidden = name.startsWith(".")

          if (!includeHidden && isHidden) {
            return null
          }

          if (entry.isDirectory() && FS_IGNORED_DIRECTORY_NAMES.has(name)) {
            return null
          }

          if (!(entry.isDirectory() || entry.isFile())) {
            return null
          }

          const absoluteEntryPath = path.join(canonicalPath, name)
          const stats = await fileSystemRepository.lstatPath(absoluteEntryPath)

          const item: FileSystemListEntry = {
            name,
            path: normalizePathSeparators(absoluteEntryPath),
            type: entry.isDirectory() ? "directory" : "file",
            isHidden,
            isSymlink: stats?.isSymbolicLink() ?? false,
            size: entry.isFile() ? (stats?.size ?? null) : null,
            mtime: toIsoTime(stats?.mtime ?? null),
          }

          return item
        }),
      )

      const sortedEntries = mappedEntries
        .filter((value): value is FileSystemListEntry => value !== null)
        .sort((first, second) => {
          if (first.type !== second.type) {
            return first.type === "directory" ? -1 : 1
          }
          return first.name.localeCompare(second.name, "en")
        })

      if (offset > sortedEntries.length) {
        throw createFileSystemError.invalidCursor(
          "Cursor is out of range for current directory entries.",
          { cursor: input.cursor, total: sortedEntries.length },
        )
      }

      const pagedEntries = sortedEntries.slice(offset, offset + limit)
      const nextOffset = offset + pagedEntries.length
      const nextCursor =
        nextOffset < sortedEntries.length ? String(nextOffset) : null

      return {
        path: normalizePathSeparators(canonicalPath),
        parentPath:
          canonicalPath === allowedRootPath
            ? null
            : normalizePathSeparators(path.dirname(canonicalPath)),
        entries: pagedEntries,
        nextCursor,
        truncated: nextCursor !== null,
      }
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error
      }

      throw createFileSystemError.internalError(
        "Failed to list directory.",
        error,
      )
    }
  }

  return {
    listDirectory,
  }
}

export type FileSystemService = ReturnType<typeof createFileSystemService>
