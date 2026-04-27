import { ERROR_CODES } from "@/constants"
import {
  parseJsonResponse,
  toIsoDateString,
  toOptionalIsoDateString,
  toStringOrNull,
} from "@/lib/protocol"
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

export class AuthSessionResponseError extends Error {
  code: string
  status: number

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message)
    this.name = "AuthSessionResponseError"
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

function toAuthSessionResponseError(
  payload: AuthEnvelopePayload | null,
  response: Response,
  fallbackMessage: string,
) {
  const code =
    toStringOrNull(payload?.error?.code) ?? ERROR_CODES.INTERNAL_ERROR
  const message = toStringOrNull(payload?.error?.message) ?? fallbackMessage

  return new AuthSessionResponseError(message, {
    code,
    status: response.status,
  })
}

export async function parseAuthSessionResponse(
  response: Response,
): Promise<AuthSession> {
  const payload = await parseJsonResponse<AuthEnvelopePayload>(response)

  if (!response.ok || payload?.ok === false) {
    throw toAuthSessionResponseError(
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
