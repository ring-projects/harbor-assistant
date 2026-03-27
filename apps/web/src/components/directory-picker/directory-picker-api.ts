"use client"

import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import type {
  DirectoryEntry,
  DirectoryListErrorResponse,
  DirectoryListSuccessResponse,
  DirectoryPickerSelection,
  DirectoryRoot,
} from "./types"

type BootstrapRootsSuccessResponse = {
  ok: true
  roots: DirectoryRoot[]
}

type BootstrapListEntry = DirectoryEntry & {
  absolutePath: string
}

type BootstrapListPayload = {
  ok: true
  listing: {
    rootId: string
    rootPath: string
    path: string | null
    absolutePath: string
    parentPath: string | null
    entries: BootstrapListEntry[]
    nextCursor: string | null
    truncated: boolean
  }
}

type BootstrapStatPayload = {
  ok: true
  pathInfo: {
    rootId: string
    rootPath: string
    path: string | null
    absolutePath: string
    type: "directory" | "file"
    isHidden: boolean
    isSymlink: boolean
    size: number | null
    mtime: string | null
  }
}

function normalizePathForCompare(path: string) {
  if (path === "/") {
    return "/"
  }

  return path.replace(/\/+$/, "")
}

function isSameOrChildPath(path: string, parentPath: string) {
  const normalizedPath = normalizePathForCompare(path)
  const normalizedParentPath = normalizePathForCompare(parentPath)

  return (
    normalizedPath === normalizedParentPath ||
    normalizedPath.startsWith(`${normalizedParentPath}/`)
  )
}

function toErrorMessage(
  payload: DirectoryListErrorResponse | null,
  fallback: string,
) {
  if (!payload) {
    return fallback
  }

  return payload.error?.message ?? fallback
}

function toRelativePath(absolutePath: string | null, rootPath: string) {
  if (!absolutePath) {
    return undefined
  }

  const normalizedAbsolutePath = normalizePathForCompare(absolutePath)
  const normalizedRootPath = normalizePathForCompare(rootPath)

  if (
    normalizedAbsolutePath === normalizedRootPath ||
    normalizedAbsolutePath === "."
  ) {
    return undefined
  }

  return normalizedAbsolutePath.slice(normalizedRootPath.length).replace(/^\/+/, "")
}

function toAbsolutePath(rootPath: string, relativePath: string | null) {
  if (!relativePath) {
    return rootPath
  }

  return `${normalizePathForCompare(rootPath)}/${relativePath.replace(/^\/+/, "")}`
}

function pickBootstrapRoot(roots: DirectoryRoot[], absolutePath: string | null) {
  if (roots.length === 0) {
    throw new Error("No bootstrap filesystem roots are configured.")
  }

  if (absolutePath) {
    const matchedRoot = roots
      .filter((root) => isSameOrChildPath(absolutePath, root.path))
      .sort((left, right) => right.path.length - left.path.length)[0]

    if (matchedRoot) {
      return matchedRoot
    }
  }

  return roots.find((root) => root.isDefault) ?? roots[0]
}

export async function readBootstrapDirectoryRoots(): Promise<DirectoryRoot[]> {
  const response = await fetch(buildExecutorApiUrl("/v1/bootstrap/filesystem/roots"), {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  })

  const payload = (await response
    .json()
    .catch(() => null)) as BootstrapRootsSuccessResponse | DirectoryListErrorResponse | null

  if (!payload || !response.ok || payload.ok !== true) {
    throw new Error(
      toErrorMessage(payload as DirectoryListErrorResponse | null, "Failed to load directories."),
    )
  }

  return payload.roots
}

export async function readBootstrapDirectoryEntries(input: {
  path: string | null
  includeHidden: boolean
  pageSize: number
}): Promise<DirectoryListSuccessResponse> {
  const roots = await readBootstrapDirectoryRoots()
  const root = pickBootstrapRoot(roots, input.path)
  const response = await fetch(buildExecutorApiUrl("/v1/bootstrap/filesystem/list"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      rootId: root.id,
      path: toRelativePath(input.path, root.path),
      limit: input.pageSize,
      includeHidden: input.includeHidden,
      cursor: null,
      directoriesOnly: true,
    }),
  })

  const payload = (await response
    .json()
    .catch(() => null)) as BootstrapListPayload | DirectoryListErrorResponse | null

  if (!payload || !response.ok || payload.ok !== true) {
    throw new Error(
      toErrorMessage(payload as DirectoryListErrorResponse | null, "Failed to list directories."),
    )
  }

  return {
    ok: true,
    rootId: payload.listing.rootId,
    rootPath: payload.listing.rootPath,
    path: payload.listing.absolutePath,
    parentPath:
      payload.listing.parentPath === null
        ? null
        : toAbsolutePath(payload.listing.rootPath, payload.listing.parentPath),
    entries: payload.listing.entries.map((entry) => ({
      ...entry,
      path: entry.absolutePath,
    })),
    nextCursor: payload.listing.nextCursor,
    truncated: payload.listing.truncated,
  }
}

export async function statBootstrapDirectorySelection(
  selection: DirectoryPickerSelection,
) {
  const searchParams = new URLSearchParams({
    rootId: selection.rootId,
  })

  const relativePath = toRelativePath(selection.path, selection.rootPath)
  if (relativePath) {
    searchParams.set("path", relativePath)
  }

  const response = await fetch(
    buildExecutorApiUrl(`/v1/bootstrap/filesystem/stat?${searchParams.toString()}`),
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = (await response
    .json()
    .catch(() => null)) as BootstrapStatPayload | DirectoryListErrorResponse | null

  if (!payload || !response.ok || payload.ok !== true) {
    throw new Error(
      toErrorMessage(payload as DirectoryListErrorResponse | null, "Failed to validate directory."),
    )
  }

  return payload.pathInfo
}
