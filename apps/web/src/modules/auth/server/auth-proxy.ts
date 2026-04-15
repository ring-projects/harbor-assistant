import { parseJsonResponse, toIsoDateString, toOptionalIsoDateString, toStringOrNull } from "@/lib/protocol"
import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import { ERROR_CODES } from "@/constants"
import type { AuthSession, AuthUser } from "../types"

type AuthApiError = {
  code?: unknown
  message?: unknown
}

type AuthEnvelopePayload = {
  ok?: boolean
  authenticated?: boolean
  user?: unknown
  error?: AuthApiError
} & Record<string, unknown>

export class AuthProxyError extends Error {
  code: string
  status: number

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message)
    this.name = "AuthProxyError"
    this.code = options?.code ?? ERROR_CODES.INTERNAL_ERROR
    this.status = options?.status ?? 500
  }
}

function extractAuthUser(candidate: unknown): AuthUser | null {
  if (!candidate || typeof candidate !== "object") {
    return null
  }

  const source = candidate as Record<string, unknown>
  const id = toStringOrNull(source.id)
  const githubLogin = toStringOrNull(source.githubLogin)
  const status = toStringOrNull(source.status)

  if (!id || !githubLogin || (status !== "active" && status !== "disabled")) {
    return null
  }

  return {
    id,
    githubLogin,
    name: toStringOrNull(source.name),
    email: toStringOrNull(source.email),
    avatarUrl: toStringOrNull(source.avatarUrl),
    status,
    lastLoginAt: toOptionalIsoDateString(source.lastLoginAt),
    createdAt: toIsoDateString(source.createdAt),
    updatedAt: toIsoDateString(source.updatedAt),
  }
}

function toAuthProxyError(
  payload: AuthEnvelopePayload | null,
  response: Response,
  fallbackMessage: string,
) {
  const code = toStringOrNull(payload?.error?.code) ?? ERROR_CODES.INTERNAL_ERROR
  const message = toStringOrNull(payload?.error?.message) ?? fallbackMessage

  return new AuthProxyError(message, {
    code,
    status: response.status,
  })
}

export async function parseAuthSessionResponse(
  response: Response,
): Promise<AuthSession> {
  const payload = await parseJsonResponse<AuthEnvelopePayload>(response)

  if (!response.ok || payload?.ok === false) {
    throw toAuthProxyError(
      payload,
      response,
      "Failed to load auth session.",
    )
  }

  return {
    authenticated: Boolean(payload?.authenticated),
    user: extractAuthUser(payload?.user),
  }
}

function extractSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & {
    getSetCookie?: () => string[]
    getAll?: (name: string) => string[]
  }).getSetCookie

  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers)
  }

  const getAll = (headers as Headers & {
    getAll?: (name: string) => string[]
  }).getAll

  if (typeof getAll === "function") {
    return getAll.call(headers, "set-cookie")
  }

  const singleValue = headers.get("set-cookie")
  return singleValue ? [singleValue] : []
}

function cloneProxyResponseHeaders(headers: Headers) {
  const responseHeaders = new Headers()

  headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return
    }

    responseHeaders.append(key, value)
  })

  for (const cookie of extractSetCookieHeaders(headers)) {
    responseHeaders.append("set-cookie", cookie)
  }

  return responseHeaders
}

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

export async function proxyExecutorAuthRequest(
  request: Request,
  path: string,
): Promise<Response> {
  const requestUrl = new URL(request.url)
  const upstreamUrl = new URL(buildExecutorApiUrl(path))
  upstreamUrl.search = requestUrl.search

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers: buildForwardHeaders(request),
    redirect: "manual",
  })

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: cloneProxyResponseHeaders(upstreamResponse.headers),
  })
}

export async function readServerAuthSession(request: Request) {
  const response = await fetch(buildExecutorApiUrl("/v1/auth/session"), {
    method: "GET",
    cache: "no-store",
    headers: buildForwardHeaders(request),
  })

  return parseAuthSessionResponse(response)
}
