import { createServerFn, getGlobalStartContext } from "@tanstack/react-start"

import { buildHarborApiUrl } from "@/lib/harbor-api-url"
import { parseAuthSessionResponse } from "../lib/auth-session-response"

function buildForwardHeaders(request: Request) {
  const headers = new Headers()
  const cookie = request.headers.get("cookie")
  const accept = request.headers.get("accept")
  const userAgent = request.headers.get("user-agent")
  const xForwardedFor = request.headers.get("x-forwarded-for")
  const xForwardedProto = request.headers.get("x-forwarded-proto")
  const xForwardedHost = request.headers.get("x-forwarded-host")

  if (cookie) {
    headers.set("cookie", cookie)
  }

  if (accept) {
    headers.set("accept", accept)
  }

  if (userAgent) {
    headers.set("user-agent", userAgent)
  }

  if (xForwardedFor) {
    headers.set("x-forwarded-for", xForwardedFor)
  }

  if (xForwardedProto) {
    headers.set("x-forwarded-proto", xForwardedProto)
  }

  if (xForwardedHost) {
    headers.set("x-forwarded-host", xForwardedHost)
  }

  return headers
}

export const readCurrentAuthSession = createServerFn({
  method: "GET",
}).handler(async () => {
  const startContext = getGlobalStartContext() as
    | { request?: Request }
    | undefined

  if (!startContext?.request) {
    throw new Error("Request context is unavailable for auth session lookup.")
  }

  const response = await fetch(buildHarborApiUrl("/v1/auth/session"), {
    method: "GET",
    cache: "no-store",
    headers: buildForwardHeaders(startContext.request),
  })

  return parseAuthSessionResponse(response)
})
