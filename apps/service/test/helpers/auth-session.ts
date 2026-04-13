import type { PrismaClient } from "@prisma/client"

import {
  HARBOR_SESSION_COOKIE_NAME,
  PrismaAuthSessionStore,
} from "../../src/modules/auth"
import { PrismaUserIdentityRegistry } from "../../src/modules/user"

export async function createAuthSessionCookie(
  prisma: PrismaClient,
  input?: {
    githubLogin?: string
    email?: string | null
    name?: string | null
  },
) {
  const sessionStore = new PrismaAuthSessionStore(prisma)
  const userIdentityRegistry = new PrismaUserIdentityRegistry(prisma)
  const suffix = Math.random().toString(36).slice(2, 10)
  const user = await userIdentityRegistry.upsertGitHubUser({
    providerUserId: `github-user-${suffix}`,
    login: input?.githubLogin ?? `user-${suffix}`,
    email: input?.email ?? `user-${suffix}@example.com`,
    name: input?.name ?? "Test User",
    avatarUrl: null,
  })
  const session = await sessionStore.createSession({
    userId: user.id,
    userAgent: "vitest",
    ip: "127.0.0.1",
  })

  return {
    user,
    cookie: `${HARBOR_SESSION_COOKIE_NAME}=${encodeURIComponent(session.token)}`,
  }
}
