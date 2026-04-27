import fastifyCookie from "@fastify/cookie"
import fp from "fastify-plugin"

import type { ServiceConfig } from "../../../config"
import { AppError } from "../../../lib/errors/app-error"
import { ERROR_CODES } from "../../../constants/errors"
import { HARBOR_SESSION_COOKIE_NAME } from "../constants"
import { PrismaAgentTokenStore } from "../infrastructure/prisma-agent-token-store"
import {
  PrismaAuthSessionStore,
  type AuthenticatedRequestContext,
} from "../infrastructure/prisma-auth-session-store"

export function requireAuthenticatedRequest(request: {
  auth: FastifyAuthContext | null
}) {
  if (!request.auth) {
    throw new AppError(
      ERROR_CODES.AUTH_REQUIRED,
      401,
      "Authentication required.",
    )
  }

  return request.auth
}

export async function requireAuthenticatedPreHandler(request: {
  auth: FastifyAuthContext | null
}) {
  requireAuthenticatedRequest(request)
}

export function requireUserAuthenticatedRequest(request: {
  auth: FastifyAuthContext | null
}) {
  const auth = requireAuthenticatedRequest(request)
  if (auth.kind === "agent") {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      403,
      "User authentication required.",
    )
  }

  return auth
}

export function getAuthenticatedActor(request: {
  auth: FastifyAuthContext | null
}) {
  const auth = requireAuthenticatedRequest(request)
  if (auth.kind === "agent") {
    return auth.actor
  }

  return auth.actor ?? { kind: "user", userId: auth.userId }
}

type FastifyAuthContext = AuthenticatedRequestContext

function parseBearerToken(header: string | undefined) {
  if (!header) {
    return null
  }

  const match = header.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  return token ? token : null
}

export default fp(async (app, _options: { config: ServiceConfig }) => {
  await app.register(fastifyCookie)

  const authStore = new PrismaAuthSessionStore(app.prisma)
  const agentTokenStore = new PrismaAgentTokenStore(app.prisma)

  app.decorateRequest("auth", null)

  app.addHook("onRequest", async (request) => {
    const bearerToken = parseBearerToken(request.headers.authorization)
    if (bearerToken) {
      const auth = await agentTokenStore.getAuthContextByToken(bearerToken)
      request.auth = auth

      if (auth?.kind === "agent") {
        await agentTokenStore.touchToken(auth.tokenId)
      }
      return
    }

    const sessionToken = request.cookies[HARBOR_SESSION_COOKIE_NAME]
    if (!sessionToken) {
      request.auth = null
      return
    }

    const auth = await authStore.getSessionByToken(sessionToken)
    request.auth = auth

    if (auth && auth.kind !== "agent") {
      await authStore.touchSession(auth.sessionId)
    }
  })
})
