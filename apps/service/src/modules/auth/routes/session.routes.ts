import type { FastifyInstance } from "fastify"

import type { ServiceConfig } from "../../../config"
import { parseCookieHeader, expireCookie } from "../../../lib/http/cookies"
import {
  HARBOR_SESSION_COOKIE_NAME,
} from "../constants"
import type { PrismaAuthSessionStore } from "../infrastructure/prisma-auth-session-store"
import { buildSessionCookieOptions } from "../lib/session-cookie-options"
import { requireAuthenticatedRequest } from "../plugin/auth-session"
import {
  getAuthSessionRouteSchema,
  logoutRouteSchema,
} from "../schemas"

export async function registerAuthSessionRoutes(
  app: FastifyInstance,
  options: {
    config: ServiceConfig
    sessionStore: PrismaAuthSessionStore
  },
) {
  app.get(
    "/auth/session",
    {
      schema: getAuthSessionRouteSchema,
    },
    async (request) => {
      return {
        ok: true,
        authenticated: Boolean(request.auth),
        user: request.auth?.user ?? null,
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
      const cookies = parseCookieHeader(request.headers.cookie)
      const token = cookies.get(HARBOR_SESSION_COOKIE_NAME)

      if (token) {
        await options.sessionStore.revokeSessionByToken(token)
      } else {
        await options.sessionStore.revokeSession(auth.sessionId)
      }

      reply.header(
        "set-cookie",
        expireCookie(
          HARBOR_SESSION_COOKIE_NAME,
          buildSessionCookieOptions(options.config),
        ),
      )

      return {
        ok: true,
      }
    },
  )
}
