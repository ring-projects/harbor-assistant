import fp from "fastify-plugin"

import type { ServiceConfig } from "../../../config"
import { AppError } from "../../../lib/errors/app-error"
import { ERROR_CODES } from "../../../constants/errors"
import { parseCookieHeader } from "../lib/cookies"
import { HARBOR_SESSION_COOKIE_NAME } from "../constants"
import { PrismaAuthStore } from "../infrastructure/prisma-auth-store"

export function requireAuthenticatedRequest(request: { auth: FastifyAuthContext | null }) {
  if (!request.auth) {
    throw new AppError(ERROR_CODES.AUTH_REQUIRED, 401, "Authentication required.")
  }

  return request.auth
}

export async function requireAuthenticatedPreHandler(
  request: { auth: FastifyAuthContext | null },
) {
  requireAuthenticatedRequest(request)
}

type FastifyAuthContext = Awaited<
  ReturnType<PrismaAuthStore["getSessionByToken"]>
>

export default fp(async (app, _options: { config: ServiceConfig }) => {
  const authStore = new PrismaAuthStore(app.prisma)

  app.decorateRequest("auth", null)

  app.addHook("onRequest", async (request) => {
    const cookies = parseCookieHeader(request.headers.cookie)
    const token = cookies.get(HARBOR_SESSION_COOKIE_NAME)

    if (!token) {
      request.auth = null
      return
    }

    const auth = await authStore.getSessionByToken(token)
    request.auth = auth

    if (auth) {
      await authStore.touchSession(auth.sessionId)
    }
  })
})
