import type { PrismaClient } from "@prisma/client"

import { HARBOR_SESSION_COOKIE_NAME, PrismaAuthStore } from "../../src/modules/auth"

export async function createAuthSessionCookie(
  prisma: PrismaClient,
  input?: {
    githubLogin?: string
    email?: string | null
    name?: string | null
  },
) {
  const authStore = new PrismaAuthStore(prisma)
  const suffix = Math.random().toString(36).slice(2, 10)
  const user = await authStore.upsertGitHubUser({
    providerUserId: `github-user-${suffix}`,
    login: input?.githubLogin ?? `user-${suffix}`,
    email: input?.email ?? `user-${suffix}@example.com`,
    name: input?.name ?? "Test User",
    avatarUrl: null,
  })
  const session = await authStore.createSession({
    userId: user.id,
    userAgent: "vitest",
    ip: "127.0.0.1",
  })

  return {
    user,
    cookie: `${HARBOR_SESSION_COOKIE_NAME}=${encodeURIComponent(session.token)}`,
  }
}
