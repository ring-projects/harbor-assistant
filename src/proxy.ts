import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const LAST_PROJECT_COOKIE_NAME = "harbor_last_project_id"

const RESERVED_TOP_LEVEL_SEGMENTS = new Set([
  "api",
  "_next",
  "brand",
  "initialized",
  "settings",
  "favicon.ico",
  "icon.svg",
  "logo.svg",
])

function resolveProjectId(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length < 1) {
    return null
  }

  const [first] = segments
  if (RESERVED_TOP_LEVEL_SEGMENTS.has(first)) {
    return null
  }

  return first
}

export function proxy(request: NextRequest) {
  const projectId = resolveProjectId(request.nextUrl.pathname)
  if (!projectId) {
    return NextResponse.next()
  }

  const current = request.cookies.get(LAST_PROJECT_COOKIE_NAME)?.value
  if (current === projectId) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  response.cookies.set({
    name: LAST_PROJECT_COOKIE_NAME,
    value: projectId,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}

export const config = {
  matcher: ["/:path*"],
}
