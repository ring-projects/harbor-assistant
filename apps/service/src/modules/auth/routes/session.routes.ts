import type { FastifyInstance } from "fastify"

import type { ServiceConfig } from "../../../config"
import { HARBOR_SESSION_COOKIE_NAME } from "../constants"
import type { PrismaAgentTokenStore } from "../infrastructure/prisma-agent-token-store"
import type { PrismaAuthSessionStore } from "../infrastructure/prisma-auth-session-store"
import { buildSessionCookieOptions } from "../lib/session-cookie-options"
import { requireAuthenticatedRequest } from "../plugin/auth-session"
import { getAuthSessionRouteSchema, logoutRouteSchema } from "../schemas"

export async function registerAuthSessionRoutes(
  app: FastifyInstance,
  options: {
    config: ServiceConfig
    sessionStore: PrismaAuthSessionStore
    agentTokenStore: PrismaAgentTokenStore
  },
) {
  app.get(
    "/auth/session",
    {
      schema: getAuthSessionRouteSchema,
    },
    async (request) => {
      const auth = request.auth

      const actor =
        auth?.kind === "agent"
          ? {
              kind: "agent" as const,
              tokenId: auth.tokenId,
              issuedByUserId: auth.issuedByUserId,
              scopes: auth.scopes,
              projectId: auth.projectId,
              orchestrationId: auth.orchestrationId,
              taskId: auth.taskId,
              sourceTaskId: auth.sourceTaskId,
              expiresAt: auth.expiresAt,
            }
          : auth
            ? {
                kind: "user" as const,
                userId: auth.userId,
                sessionId: auth.sessionId,
              }
            : null

      return {
        ok: true,
        authenticated: Boolean(auth),
        user: auth?.user ?? null,
        actor,
      }
    },
  )

  app.post(
    "/auth/logout",
    {
      schema: logoutRouteSchema,
    },
    async (request, reply) => {
      const auth = requireAuthenticatedRequest(request)
      const token = request.cookies[HARBOR_SESSION_COOKIE_NAME]

      if (auth.kind === "agent") {
        await options.agentTokenStore.revokeToken(auth.tokenId)
      } else if (token) {
        await options.sessionStore.revokeSessionByToken(token)
      } else {
        await options.sessionStore.revokeSession(auth.sessionId)
      }

      reply.clearCookie(
        HARBOR_SESSION_COOKIE_NAME,
        buildSessionCookieOptions(options.config),
      )

      return {
        ok: true,
      }
    },
  )
}
