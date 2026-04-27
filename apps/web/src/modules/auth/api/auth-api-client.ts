import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { buildHarborApiUrl, harborApiFetch } from "@/lib/harbor-api-url"
import { parseJsonResponse } from "@/lib/protocol"
import {
  AuthSessionResponseError,
  parseAuthSessionResponse,
} from "../lib/auth-session-response"

const authApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
})

type AuthApiError = z.infer<typeof authApiErrorSchema>

type AuthEnvelopePayload = {
  ok?: boolean
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

export async function readAuthSession() {
  const response = await harborApiFetch("/v1/auth/session", {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  })

  try {
    return await parseAuthSessionResponse(response)
  } catch (error) {
    if (error instanceof AuthSessionResponseError) {
      throw new AuthApiClientError(error.message, {
        code: error.code,
        status: error.status,
      })
    }

    throw error
  }
}

export async function logout(): Promise<void> {
  const response = await harborApiFetch("/v1/auth/logout", {
    method: "POST",
    headers: {
      accept: "application/json",
    },
  })

  const payload = await parseJsonResponse<AuthEnvelopePayload>(response)
  throwIfFailed(response, payload, "Failed to log out.")
}

export function getGitHubLoginUrl(redirectTo?: string | null) {
  const url = new URL(buildHarborApiUrl("/v1/auth/github/start"))

  if (redirectTo?.trim()) {
    url.searchParams.set("redirect", redirectTo)
  }

  return url.toString()
}
