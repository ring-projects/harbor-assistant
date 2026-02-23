export function resolveCurrentSection(pathname: string) {
  if (pathname.includes("/mcp")) {
    return "mcp"
  }
  if (pathname.includes("/skills")) {
    return "skills"
  }
  if (pathname.includes("/tasks")) {
    return "tasks"
  }
  if (pathname.includes("/docs")) {
    return "docs"
  }
  if (pathname.includes("/review")) {
    return "review"
  }

  return "review"
}

export function extractWorkspaceIdFromPath(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0]
  if (!firstSegment || firstSegment === "settings") {
    return null
  }

  return firstSegment.trim() || null
}

export function buildSectionHref(section: string, workspaceId: string | null) {
  if (!workspaceId) {
    return "/settings"
  }

  return `/${workspaceId}/${section}`
}

export function isSectionActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
