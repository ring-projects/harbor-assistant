import path from "node:path"

import {
  FS_DEFAULT_LIST_LIMIT,
  FS_IGNORED_DIRECTORY_NAMES,
  FS_MAX_LIST_LIMIT,
} from "../../../constants/fs"
import {
  ensurePathInsideRoot,
  normalizeListCursor,
  normalizeListLimit,
  normalizeOutputPath,
  resolveRequestedPath,
} from "../domain/path-policy"
import { createFileSystemError, isFileSystemError } from "../errors"
import type {
  FileSystemDirectoryEntry,
  FileSystemMetadata,
  FileSystemRepository,
} from "./filesystem-repository"

function isKnownErrorCode(error: unknown, codes: string[]) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: string }).code === "string" &&
    codes.includes((error as { code: string }).code)
  )
}

function toIsoTime(value: Date | null) {
  if (!value) {
    return null
  }

  return Number.isNaN(value.getTime()) ? null : value.toISOString()
}

function normalizeRootPathInput(rootPath: string) {
  const normalizedRootPath = rootPath.trim()
  if (!normalizedRootPath) {
    throw createFileSystemError().invalidInput("Root path is required.")
  }

  return normalizedRootPath
}

function normalizeRelativePathInput(targetPath: string | undefined) {
  return targetPath?.trim() ?? "."
}

export function toListPaging(input: {
  cursor?: string | null
  limit?: number
}) {
  try {
    return {
      offset: normalizeListCursor(input.cursor),
      limit: normalizeListLimit(
        input.limit,
        FS_DEFAULT_LIST_LIMIT,
        FS_MAX_LIST_LIMIT,
      ),
    }
  } catch {
    throw createFileSystemError().invalidCursor()
  }
}

export async function resolveRootPath(
  repository: FileSystemRepository,
  rootPath: string,
) {
  const normalizedRootPath = normalizeRootPathInput(rootPath)

  let canonicalRootPath: string
  try {
    canonicalRootPath = await repository.resolveRealPath(
      path.resolve(normalizedRootPath),
    )
  } catch (error) {
    if (isKnownErrorCode(error, ["ENOENT"])) {
      throw createFileSystemError().pathNotFound(normalizedRootPath)
    }

    if (isKnownErrorCode(error, ["EACCES", "EPERM"])) {
      throw createFileSystemError().permissionDenied(
        `Permission denied while resolving root path: ${normalizedRootPath}`,
      )
    }

    throw createFileSystemError().readFailed(
      `Failed to resolve root path: ${normalizedRootPath}`,
    )
  }

  const stats = await readMetadata(repository, canonicalRootPath)
  if (stats.kind !== "directory") {
    throw createFileSystemError().notADirectory(canonicalRootPath)
  }

  return canonicalRootPath
}

export async function resolvePathInsideRoot(
  repository: FileSystemRepository,
  input: {
    rootPath: string
    path?: string
  },
) {
  const canonicalRootPath = await resolveRootPath(repository, input.rootPath)
  const requestedPath = resolveRequestedPath(
    canonicalRootPath,
    normalizeRelativePathInput(input.path),
  )

  let canonicalTargetPath: string
  try {
    canonicalTargetPath = await repository.resolveRealPath(requestedPath)
  } catch (error) {
    if (isKnownErrorCode(error, ["ENOENT"])) {
      throw createFileSystemError().pathNotFound(requestedPath)
    }

    if (isKnownErrorCode(error, ["EACCES", "EPERM"])) {
      throw createFileSystemError().permissionDenied(
        `Permission denied while resolving path: ${requestedPath}`,
      )
    }

    throw createFileSystemError().readFailed(
      `Failed to resolve path: ${requestedPath}`,
    )
  }

  try {
    ensurePathInsideRoot(canonicalRootPath, canonicalTargetPath)
  } catch {
    throw createFileSystemError().pathOutsideAllowedRoot(
      canonicalTargetPath,
      canonicalRootPath,
    )
  }

  return {
    canonicalRootPath,
    requestedPath,
    canonicalTargetPath,
  }
}

export async function resolveCreatablePathInsideRoot(
  repository: FileSystemRepository,
  input: {
    rootPath: string
    path?: string
  },
) {
  const canonicalRootPath = await resolveRootPath(repository, input.rootPath)
  const requestedPath = resolveRequestedPath(
    canonicalRootPath,
    normalizeRelativePathInput(input.path),
  )

  let probePath = requestedPath
  const missingSegments: string[] = []

  while (true) {
    try {
      const canonicalExistingPath = await repository.resolveRealPath(probePath)

      try {
        ensurePathInsideRoot(canonicalRootPath, canonicalExistingPath)
      } catch {
        throw createFileSystemError().pathOutsideAllowedRoot(
          canonicalExistingPath,
          canonicalRootPath,
        )
      }

      const canonicalTargetPath = path.resolve(
        canonicalExistingPath,
        ...missingSegments,
      )

      try {
        ensurePathInsideRoot(canonicalRootPath, canonicalTargetPath)
      } catch {
        throw createFileSystemError().pathOutsideAllowedRoot(
          canonicalTargetPath,
          canonicalRootPath,
        )
      }

      return {
        canonicalRootPath,
        requestedPath,
        canonicalTargetPath,
      }
    } catch (error) {
      if (isFileSystemError(error)) {
        throw error
      }

      if (!isKnownErrorCode(error, ["ENOENT"])) {
        if (isKnownErrorCode(error, ["EACCES", "EPERM"])) {
          throw createFileSystemError().permissionDenied(
            `Permission denied while resolving path: ${probePath}`,
          )
        }

        throw createFileSystemError().readFailed(
          `Failed to resolve path: ${probePath}`,
        )
      }

      const parentPath = path.dirname(probePath)
      if (parentPath === probePath) {
        throw createFileSystemError().pathNotFound(requestedPath)
      }

      missingSegments.unshift(path.basename(probePath))
      probePath = parentPath
    }
  }
}

export async function readMetadata(
  repository: FileSystemRepository,
  targetPath: string,
): Promise<FileSystemMetadata> {
  try {
    return await repository.statPath(targetPath)
  } catch (error) {
    if (isKnownErrorCode(error, ["ENOENT"])) {
      throw createFileSystemError().pathNotFound(targetPath)
    }

    if (isKnownErrorCode(error, ["EACCES", "EPERM"])) {
      throw createFileSystemError().permissionDenied(
        `Permission denied while reading path: ${targetPath}`,
      )
    }

    throw createFileSystemError().readFailed(
      `Failed to stat path: ${targetPath}`,
    )
  }
}

export async function readLstatMetadata(
  repository: FileSystemRepository,
  targetPath: string,
) {
  try {
    return await repository.lstatPath(targetPath)
  } catch {
    return null
  }
}

export async function readDirectoryEntries(
  repository: FileSystemRepository,
  targetPath: string,
): Promise<FileSystemDirectoryEntry[]> {
  try {
    return await repository.readDirectory(targetPath)
  } catch (error) {
    if (isKnownErrorCode(error, ["EACCES", "EPERM"])) {
      throw createFileSystemError().permissionDenied(
        `Permission denied while listing directory: ${targetPath}`,
      )
    }

    throw createFileSystemError().readFailed(
      `Failed to list directory: ${targetPath}`,
    )
  }
}

export async function readTextFileContent(
  repository: FileSystemRepository,
  targetPath: string,
) {
  try {
    return await repository.readTextFile(targetPath)
  } catch (error) {
    if (isKnownErrorCode(error, ["EACCES", "EPERM"])) {
      throw createFileSystemError().permissionDenied(
        `Permission denied while reading file: ${targetPath}`,
      )
    }

    throw createFileSystemError().readFailed(
      `Failed to read file: ${targetPath}`,
    )
  }
}

export async function createDirectoryAtPath(
  repository: FileSystemRepository,
  targetPath: string,
  options?: { recursive?: boolean },
) {
  try {
    await repository.createDirectory(targetPath, options)
  } catch (error) {
    if (isKnownErrorCode(error, ["EACCES", "EPERM"])) {
      throw createFileSystemError().permissionDenied(
        `Permission denied while creating directory: ${targetPath}`,
      )
    }

    throw createFileSystemError().writeFailed(
      `Failed to create directory: ${targetPath}`,
    )
  }
}

export async function writeTextFileAtPath(
  repository: FileSystemRepository,
  targetPath: string,
  content: string,
) {
  try {
    await repository.writeTextFile(targetPath, content)
  } catch (error) {
    if (isKnownErrorCode(error, ["ENOENT"])) {
      throw createFileSystemError().pathNotFound(targetPath)
    }

    if (isKnownErrorCode(error, ["EACCES", "EPERM"])) {
      throw createFileSystemError().permissionDenied(
        `Permission denied while writing file: ${targetPath}`,
      )
    }

    throw createFileSystemError().writeFailed(
      `Failed to write file: ${targetPath}`,
    )
  }
}

export function toOutputPath(targetPath: string) {
  return normalizeOutputPath(targetPath)
}

export function toOutputParentPath(rootPath: string, targetPath: string) {
  if (rootPath === targetPath) {
    return null
  }

  return normalizeOutputPath(path.dirname(targetPath))
}

export function toOutputTime(value: Date | null) {
  return toIsoTime(value)
}

export function shouldSkipEntry(
  entry: FileSystemDirectoryEntry,
  includeHidden: boolean,
) {
  if (entry.kind !== "file" && entry.kind !== "directory") {
    return true
  }

  if (!includeHidden && entry.name.startsWith(".")) {
    return true
  }

  if (
    entry.kind === "directory" &&
    FS_IGNORED_DIRECTORY_NAMES.has(entry.name)
  ) {
    return true
  }

  return false
}
