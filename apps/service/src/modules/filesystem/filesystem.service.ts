import { lstat, readdir, realpath, stat } from "node:fs/promises"
import path from "node:path"

import { ERROR_CODES } from "../../constants/errors"
import {
  FS_DEFAULT_LIST_LIMIT,
  FS_IGNORED_DIRECTORY_NAMES,
  FS_MAX_LIST_LIMIT,
} from "../../constants/fs"
import { getAppConfig } from "../../utils/yaml-config"
import {
  FileSystemServiceError,
  type FileSystemListEntry,
  type FileSystemListResult,
} from "./types"

type ListDirectoryInput = {
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
    throw new FileSystemServiceError(
      ERROR_CODES.INVALID_CURSOR,
      "Cursor must be a non-negative integer string.",
    )
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

function toIsoTime(value: Date | null) {
  if (!value) {
    return null
  }

  return Number.isNaN(value.getTime()) ? null : value.toISOString()
}

async function resolveAllowedRootPath() {
  const configuredRoot = getAppConfig().fileBrowser.rootDirectory
  const absolute = path.resolve(configuredRoot)
  const canonical = await realpath(absolute).catch(() => absolute)

  const stats = await stat(canonical).catch((error) => {
    throw new FileSystemServiceError(
      ERROR_CODES.READ_ERROR,
      `Failed to read configured file browser root: ${String(error)}`,
    )
  })

  if (!stats.isDirectory()) {
    throw new FileSystemServiceError(
      ERROR_CODES.NOT_A_DIRECTORY,
      "Configured file browser root is not a directory.",
    )
  }

  return canonical
}

export async function listDirectory(
  input: ListDirectoryInput,
): Promise<FileSystemListResult> {
  const allowedRootPath = await resolveAllowedRootPath()
  const requestedPath = resolveRequestedPath(allowedRootPath, input.path)
  const offset = parseCursor(input.cursor)
  const limit = normalizeLimit(input.limit)
  const includeHidden = input.includeHidden === true

  const canonicalPath = await realpath(requestedPath).catch((error) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      throw new FileSystemServiceError(
        ERROR_CODES.PATH_NOT_FOUND,
        `Path not found: ${requestedPath}`,
      )
    }

    if (isPermissionError(error)) {
      throw new FileSystemServiceError(
        ERROR_CODES.PERMISSION_DENIED,
        `Permission denied while resolving path: ${requestedPath}`,
      )
    }

    throw new FileSystemServiceError(
      ERROR_CODES.READ_ERROR,
      `Failed to resolve path: ${requestedPath}. ${String(error)}`,
    )
  })

  if (!isPathInsideRoot(allowedRootPath, canonicalPath)) {
    throw new FileSystemServiceError(
      ERROR_CODES.PATH_OUTSIDE_ALLOWED_ROOT,
      "Requested path is outside allowed root.",
    )
  }

  const directoryStats = await stat(canonicalPath).catch((error) => {
    if (isPermissionError(error)) {
      throw new FileSystemServiceError(
        ERROR_CODES.PERMISSION_DENIED,
        `Permission denied while reading path: ${canonicalPath}`,
      )
    }

    throw new FileSystemServiceError(
      ERROR_CODES.READ_ERROR,
      `Failed to stat path: ${canonicalPath}. ${String(error)}`,
    )
  })

  if (!directoryStats.isDirectory()) {
    throw new FileSystemServiceError(
      ERROR_CODES.NOT_A_DIRECTORY,
      `Path is not a directory: ${canonicalPath}`,
    )
  }

  const entries = await readdir(canonicalPath, { withFileTypes: true }).catch(
    (error) => {
      if (isPermissionError(error)) {
        throw new FileSystemServiceError(
          ERROR_CODES.PERMISSION_DENIED,
          `Permission denied while listing directory: ${canonicalPath}`,
        )
      }

      throw new FileSystemServiceError(
        ERROR_CODES.READ_ERROR,
        `Failed to list directory: ${canonicalPath}. ${String(error)}`,
      )
    },
  )

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
      const stats = await lstat(absoluteEntryPath).catch(() => null)

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
    throw new FileSystemServiceError(
      ERROR_CODES.INVALID_CURSOR,
      "Cursor is out of range for current directory entries.",
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
}
