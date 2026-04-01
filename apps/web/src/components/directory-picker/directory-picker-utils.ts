type BreadcrumbSegment = {
  label: string
  path: string
}

function appendPathSegment(parentPath: string, segment: string) {
  if (parentPath === "/") {
    return `/${segment}`
  }

  return `${parentPath}/${segment}`
}

export function normalizePathForCompare(path: string) {
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

export function buildBreadcrumbSegments(
  currentPath: string,
  rootPath: string | null,
  rootLabel?: string | null,
): BreadcrumbSegment[] {
  if (!rootPath || !isSameOrChildPath(currentPath, rootPath)) {
    return [{ label: rootLabel?.trim() || "home", path: currentPath }]
  }

  const normalizedCurrent = normalizePathForCompare(currentPath)
  const normalizedRoot = normalizePathForCompare(rootPath)
  const relative = normalizedCurrent
    .slice(normalizedRoot.length)
    .replace(/^\/+/, "")
  const segments: BreadcrumbSegment[] = [
    { label: rootLabel?.trim() || "home", path: normalizedRoot },
  ]

  if (!relative) {
    return segments
  }

  let accumulator = normalizedRoot
  for (const segment of relative.split("/").filter(Boolean)) {
    accumulator = appendPathSegment(accumulator, segment)
    segments.push({
      label: segment,
      path: accumulator,
    })
  }

  return segments
}

export function getDirectoryPickerErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Request failed."
}
