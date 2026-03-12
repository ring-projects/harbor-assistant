type BreadcrumbSegment = {
  label: string
  path: string
}

function splitPathSegments(pathValue: string) {
  if (pathValue === "/") {
    return []
  }

  return normalizePathForCompare(pathValue).split("/").filter(Boolean)
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
): BreadcrumbSegment[] {
  if (!rootPath || !isSameOrChildPath(currentPath, rootPath)) {
    return [{ label: "home", path: currentPath }]
  }

  const normalizedCurrent = normalizePathForCompare(currentPath)
  const normalizedRoot = normalizePathForCompare(rootPath)
  const relative = normalizedCurrent
    .slice(normalizedRoot.length)
    .replace(/^\/+/, "")
  const rootParts = splitPathSegments(normalizedRoot)
  const rootLeafName = rootParts.at(-1) ?? "workspace"

  const segments: BreadcrumbSegment[] = [{ label: "home", path: normalizedRoot }]

  if (rootLeafName.toLowerCase() !== "home") {
    segments.push({
      label: rootLeafName,
      path: normalizedRoot,
    })
  }

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
