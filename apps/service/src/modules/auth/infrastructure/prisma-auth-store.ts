import type { AuthProvider, PrismaClient, User as PrismaUser } from "@prisma/client"

import type { User } from "../../user/domain/user"
import { toDomainUser } from "../../user/infrastructure/persistence/user-mapper"
import { DEFAULT_SESSION_TTL_DAYS } from "../constants"
import { createSessionToken, hashSessionToken } from "../lib/session"

type PersistedSession = {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  lastSeenAt: Date | null
  revokedAt: Date | null
  userAgent: string | null
  ip: string | null
  createdAt: Date
  updatedAt: Date
  user: PrismaUser
}

export type AuthenticatedRequestContext = {
  sessionId: string
  userId: string
  user: User
}

export class PrismaAuthStore {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertGitHubUser(input: {
    providerUserId: string
    login: string
    email: string | null
    name: string | null
    avatarUrl: string | null
    now?: Date
  }): Promise<User> {
    const now = input.now ?? new Date()
    const provider: AuthProvider = "github"

    const user = await this.prisma.$transaction(async (tx) => {
      const identity = await tx.authIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider,
            providerUserId: input.providerUserId,
          },
        },
      })

      const currentUser = identity
        ? await tx.user.findUnique({
            where: {
              id: identity.userId,
            },
          })
        : await tx.user.findUnique({
            where: {
              githubLogin: input.login,
            },
          })

      const userRecord = currentUser
        ? await tx.user.update({
            where: {
              id: currentUser.id,
            },
            data: {
              githubLogin: input.login,
              email: input.email,
              name: input.name,
              avatarUrl: input.avatarUrl,
              lastLoginAt: now,
            },
          })
        : await tx.user.create({
            data: {
              githubLogin: input.login,
              email: input.email,
              name: input.name,
              avatarUrl: input.avatarUrl,
              lastLoginAt: now,
            },
          })

      if (identity) {
        await tx.authIdentity.update({
          where: {
            id: identity.id,
          },
          data: {
            providerLogin: input.login,
            providerEmail: input.email,
          },
        })
      } else {
        await tx.authIdentity.create({
          data: {
            userId: userRecord.id,
            provider,
            providerUserId: input.providerUserId,
            providerLogin: input.login,
            providerEmail: input.email,
          },
        })
      }

      return userRecord
    })

    return toDomainUser(user)
  }

  async createSession(input: {
    userId: string
    ttlDays?: number
    userAgent?: string | null
    ip?: string | null
    now?: Date
  }) {
    const now = input.now ?? new Date()
    const token = createSessionToken()
    const tokenHash = hashSessionToken(token)
    const expiresAt = new Date(
      now.getTime() + (input.ttlDays ?? DEFAULT_SESSION_TTL_DAYS) * 24 * 60 * 60 * 1000,
    )

    const session = await this.prisma.authSession.create({
      data: {
        userId: input.userId,
        tokenHash,
        expiresAt,
        lastSeenAt: now,
        userAgent: input.userAgent ?? null,
        ip: input.ip ?? null,
      },
    })

    return {
      sessionId: session.id,
      token,
      expiresAt,
    }
  }

  async getSessionByToken(
    token: string,
    now = new Date(),
  ): Promise<AuthenticatedRequestContext | null> {
    const session = await this.prisma.authSession.findUnique({
      where: {
        tokenHash: hashSessionToken(token),
      },
      include: {
        user: true,
      },
    })

    return this.toAuthenticatedContext(session, now)
  }

  async touchSession(sessionId: string, now = new Date()) {
    await this.prisma.authSession.update({
      where: {
        id: sessionId,
      },
      data: {
        lastSeenAt: now,
      },
    })
  }

  async revokeSession(sessionId: string, now = new Date()) {
    await this.prisma.authSession.update({
      where: {
        id: sessionId,
      },
      data: {
        revokedAt: now,
      },
    })
  }

  async revokeSessionByToken(token: string, now = new Date()) {
    const session = await this.prisma.authSession.findUnique({
      where: {
        tokenHash: hashSessionToken(token),
      },
    })

    if (!session) {
      return
    }

    await this.revokeSession(session.id, now)
  }

  private toAuthenticatedContext(
    session: PersistedSession | null,
    now: Date,
  ): AuthenticatedRequestContext | null {
    if (!session) {
      return null
    }

    if (session.revokedAt || session.expiresAt.getTime() <= now.getTime()) {
      return null
    }

    if (session.user.status !== "active") {
      return null
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      user: toDomainUser(session.user),
    }
  }
}
