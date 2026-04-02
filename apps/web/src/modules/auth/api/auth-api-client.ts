import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { executorApiFetch, getExecutorApiBaseUrl } from "@/lib/executor-service-url"
import { parseJsonResponse, toIsoDateString, toOptionalIsoDateString, toStringOrNull } from "@/lib/protocol"
import type { AuthSession, AuthUser } from "../types"

const authApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
})

type AuthApiError = z.infer<typeof authApiErrorSchema>

type AuthEnvelopePayload = {
  ok?: boolean
  authenticated?: boolean
  user?: unknown
  error?: AuthApiError
} & Record<string, unknown>

export class AuthApiClientError extends Error {
  code: string
  status: number

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message)
    this.name = "AuthApiClientError"
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

  if (
    !id ||
    !githubLogin ||
    (status !== "active" && status !== "disabled")
  ) {
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

function throwIfFailed(
  response: Response,
  payload: AuthEnvelopePayload | null,
  fallbackMessage: string,
) {
  const parsedError = authApiErrorSchema.safeParse(payload?.error)

  if (response.ok && payload?.ok !== false) {
    return
  }

  throw new AuthApiClientError(
    parsedError.success ? parsedError.data.message : fallbackMessage,
    {
      code: parsedError.success
        ? parsedError.data.code
        : ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    },
  )
}

export async function readAuthSession(): Promise<AuthSession> {
  const response = await executorApiFetch("/v1/auth/session", {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  })

  const payload = await parseJsonResponse<AuthEnvelopePayload>(response)
  throwIfFailed(response, payload, "Failed to load auth session.")

  return {
    authenticated: Boolean(payload?.authenticated),
    user: extractAuthUser(payload?.user),
  }
}

export async function logout(): Promise<void> {
  const response = await executorApiFetch("/v1/auth/logout", {
    method: "POST",
    headers: {
      accept: "application/json",
    },
  })

  const payload = await parseJsonResponse<AuthEnvelopePayload>(response)
  throwIfFailed(response, payload, "Failed to log out.")
}

export function getGitHubLoginUrl() {
  return `${getExecutorApiBaseUrl()}/v1/auth/github/start`
}
