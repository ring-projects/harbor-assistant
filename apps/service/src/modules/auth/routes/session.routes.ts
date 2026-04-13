import type { FastifyInstance } from "fastify"

import type { ServiceConfig } from "../../../config"
import { parseCookieHeader, expireCookie } from "../../../lib/http/cookies"
import {
  HARBOR_SESSION_COOKIE_NAME,
} from "../constants"
import type { PrismaAuthSessionStore } from "../infrastructure/prisma-auth-session-store"
import { requireAuthenticatedRequest } from "../plugin/auth-session"

function isSecureCookie(config: ServiceConfig) {
  return config.isProduction
}

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
      schema: {
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["ok", "authenticated", "user"],
            properties: {
              ok: { type: "boolean", const: true },
              authenticated: { type: "boolean" },
              user: {
                anyOf: [
                  {
                    type: "null",
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "id",
                      "githubLogin",
                      "name",
                      "email",
                      "avatarUrl",
                      "status",
                      "lastLoginAt",
                      "createdAt",
                      "updatedAt",
                    ],
                    properties: {
                      id: { type: "string" },
                      githubLogin: { type: "string" },
                      name: { type: ["string", "null"] },
                      email: { type: ["string", "null"] },
                      avatarUrl: { type: ["string", "null"] },
                      status: { type: "string", enum: ["active", "disabled"] },
                      lastLoginAt: { type: ["string", "null"], format: "date-time" },
                      createdAt: { type: "string", format: "date-time" },
                      updatedAt: { type: "string", format: "date-time" },
                    },
                  },
                ],
              },
            },
          },
        },
      },
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
        expireCookie(HARBOR_SESSION_COOKIE_NAME, {
          secure: isSecureCookie(options.config),
          sameSite: "Lax",
          path: "/",
        }),
      )

      return {
        ok: true,
      }
    },
  )
}
