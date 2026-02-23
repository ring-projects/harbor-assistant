import path from "node:path"

import type { BrowseDirectoryInput } from "@/services/file-browser/types"

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function toIntegerOrFallback(
  value: number | undefined,
  fallback: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.trunc(value)
}

export function toUnixPath(value: string) {
  return value.split(path.sep).join("/")
}

export function toRelativePath(root: string, absolutePath: string) {
  const relative = path.relative(root, absolutePath)
  return relative === "" ? "." : toUnixPath(relative)
}

export function isInsideRoot(root: string, target: string) {
  const relative = path.relative(root, target)
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  )
}

export function normalizeBrowseDirectoryInput(
  input: BrowseDirectoryInput,
  limits: {
    defaultDepth: number
    maxDepth: number
    defaultMaxEntriesPerDirectory: number
    maxEntriesPerDirectory: number
    defaultMaxNodes: number
    maxNodes: number
  },
) {
  const targetPath = (input.path ?? ".").trim() || "."
  const depth = clampNumber(
    toIntegerOrFallback(input.depth, limits.defaultDepth),
    1,
    limits.maxDepth,
  )
  const maxEntriesPerDirectory = clampNumber(
    toIntegerOrFallback(
      input.maxEntriesPerDirectory,
      limits.defaultMaxEntriesPerDirectory,
    ),
    1,
    limits.maxEntriesPerDirectory,
  )
  const maxNodes = clampNumber(
    toIntegerOrFallback(input.maxNodes, limits.defaultMaxNodes),
    1,
    limits.maxNodes,
  )

  return {
    targetPath,
    depth,
    includeHidden: Boolean(input.includeHidden),
    maxEntriesPerDirectory,
    maxNodes,
  }
}
