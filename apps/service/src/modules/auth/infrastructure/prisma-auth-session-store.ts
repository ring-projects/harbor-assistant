import type { PrismaClient, User as PrismaUser } from "@prisma/client"

import type { User } from "../../user"
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

export class PrismaAuthSessionStore {
  constructor(private readonly prisma: PrismaClient) {}

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
