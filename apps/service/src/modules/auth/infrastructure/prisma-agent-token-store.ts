import type { AgentToken, PrismaClient } from "@prisma/client"

import type { AuthorizationAction } from "../../authorization"
import {
  clampAgentTokenTtlSeconds,
  normalizeAgentTokenScopes,
  toAuthorizationAgentActor,
  type AgentTokenAuthContext,
  type AgentTokenRecord,
} from "../application/agent-token"
import { createSessionToken, hashSessionToken } from "../lib/session"

function toAgentTokenRecord(token: AgentToken): AgentTokenRecord {
  const rawScopes = Array.isArray(token.scopes) ? token.scopes : []

  return {
    id: token.id,
    name: token.name,
    issuedByUserId: token.issuedByUserId,
    parentTokenId: token.parentTokenId,
    projectId: token.projectId,
    orchestrationId: token.orchestrationId,
    taskId: token.taskId,
    sourceTaskId: token.sourceTaskId,
    scopes: normalizeAgentTokenScopes(
      rawScopes.filter(
        (item: unknown): item is AuthorizationAction =>
          typeof item === "string",
      ),
    ),
    expiresAt: token.expiresAt,
    lastSeenAt: token.lastSeenAt,
    revokedAt: token.revokedAt,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
  }
}

export class PrismaAgentTokenStore {
  constructor(private readonly prisma: PrismaClient) {}

  async createToken(input: {
    name?: string | null
    issuedByUserId?: string | null
    parentTokenId?: string | null
    projectId?: string | null
    orchestrationId?: string | null
    taskId?: string | null
    sourceTaskId?: string | null
    scopes: readonly AuthorizationAction[]
    ttlSeconds?: number | null
    now?: Date
  }) {
    const now = input.now ?? new Date()
    const token = createSessionToken()
    const tokenHash = hashSessionToken(token)
    const ttlSeconds = clampAgentTokenTtlSeconds(input.ttlSeconds)
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)
    const scopes = normalizeAgentTokenScopes(input.scopes)

    const created = await this.prisma.agentToken.create({
      data: {
        name: input.name?.trim() || null,
        tokenHash,
        issuedByUserId: input.issuedByUserId?.trim() || null,
        parentTokenId: input.parentTokenId?.trim() || null,
        projectId: input.projectId?.trim() || null,
        orchestrationId: input.orchestrationId?.trim() || null,
        taskId: input.taskId?.trim() || null,
        sourceTaskId: input.sourceTaskId?.trim() || null,
        scopes,
        expiresAt,
        lastSeenAt: now,
      },
    })

    return {
      token,
      record: toAgentTokenRecord(created),
    }
  }

  async getAuthContextByToken(
    token: string,
    now = new Date(),
  ): Promise<AgentTokenAuthContext | null> {
    const persisted = await this.prisma.agentToken.findUnique({
      where: {
        tokenHash: hashSessionToken(token),
      },
    })

    const record = persisted ? toAgentTokenRecord(persisted) : null
    if (!record) {
      return null
    }

    if (record.revokedAt || record.expiresAt.getTime() <= now.getTime()) {
      return null
    }

    return {
      kind: "agent",
      tokenId: record.id,
      issuedByUserId: record.issuedByUserId,
      userId: record.issuedByUserId ?? "",
      user: null,
      scopes: record.scopes,
      projectId: record.projectId,
      orchestrationId: record.orchestrationId,
      taskId: record.taskId,
      sourceTaskId: record.sourceTaskId,
      expiresAt: record.expiresAt,
      actor: toAuthorizationAgentActor(record),
    }
  }

  async touchToken(tokenId: string, now = new Date()) {
    await this.prisma.agentToken.update({
      where: {
        id: tokenId,
      },
      data: {
        lastSeenAt: now,
      },
    })
  }

  async revokeToken(tokenId: string, now = new Date()) {
    await this.prisma.agentToken.update({
      where: {
        id: tokenId,
      },
      data: {
        revokedAt: now,
      },
    })
  }

  async findById(tokenId: string): Promise<AgentTokenRecord | null> {
    const token = await this.prisma.agentToken.findUnique({
      where: {
        id: tokenId,
      },
    })

    return token ? toAgentTokenRecord(token) : null
  }
}
