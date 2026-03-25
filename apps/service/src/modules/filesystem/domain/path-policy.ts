import path from "node:path"

export function resolveRequestedPath(rootPath: string, requestedPath?: string) {
  const value = requestedPath?.trim()
  if (!value || value === ".") {
    return path.resolve(rootPath)
  }

  return path.isAbsolute(value)
    ? path.resolve(value)
    : path.resolve(rootPath, value)
}

export function isPathInsideRoot(rootPath: string, absolutePath: string) {
  const relative = path.relative(rootPath, absolutePath)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

export function ensurePathInsideRoot(rootPath: string, absolutePath: string) {
  if (!isPathInsideRoot(rootPath, absolutePath)) {
    throw new Error("outside allowed root")
  }
}

export function normalizeListCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return 0
  }

  const offset = Number(cursor)
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error("cursor must be a non-negative integer string")
  }

  return offset
}

export function normalizeListLimit(
  limit: number | undefined,
  defaultLimit: number,
  maxLimit: number,
) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return defaultLimit
  }

  return Math.min(maxLimit, Math.max(1, Math.trunc(limit)))
}

export function normalizeOutputPath(targetPath: string) {
  return targetPath.split(path.sep).join("/")
}
