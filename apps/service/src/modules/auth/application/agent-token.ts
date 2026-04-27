import type {
  AuthorizationAction,
  AuthorizationActor,
} from "../../authorization"

export const DEFAULT_AGENT_TOKEN_TTL_SECONDS = 12 * 60 * 60
export const MAX_AGENT_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

export type AgentTokenScope = AuthorizationAction

export type AgentTokenRecord = {
  id: string
  name: string | null
  issuedByUserId: string | null
  parentTokenId: string | null
  projectId: string | null
  orchestrationId: string | null
  taskId: string | null
  sourceTaskId: string | null
  scopes: AgentTokenScope[]
  expiresAt: Date
  lastSeenAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type AgentTokenAuthContext = {
  kind: "agent"
  tokenId: string
  issuedByUserId: string | null
  userId: string
  user: null
  scopes: AgentTokenScope[]
  projectId: string | null
  orchestrationId: string | null
  taskId: string | null
  sourceTaskId: string | null
  expiresAt: Date
  actor: Extract<AuthorizationActor, { kind: "agent" }>
}

export function normalizeAgentTokenScopes(
  scopes: readonly AgentTokenScope[],
): AgentTokenScope[] {
  return [
    ...new Set(scopes.map((scope) => scope.trim()).filter(Boolean)),
  ].sort() as AgentTokenScope[]
}

export function clampAgentTokenTtlSeconds(input?: number | null): number {
  if (!Number.isFinite(input)) {
    return DEFAULT_AGENT_TOKEN_TTL_SECONDS
  }

  return Math.max(60, Math.min(MAX_AGENT_TOKEN_TTL_SECONDS, Math.floor(input!)))
}

export function toAuthorizationAgentActor(
  token: Pick<
    AgentTokenRecord,
    | "id"
    | "issuedByUserId"
    | "scopes"
    | "projectId"
    | "orchestrationId"
    | "taskId"
  >,
): Extract<AuthorizationActor, { kind: "agent" }> {
  return {
    kind: "agent",
    tokenId: token.id,
    issuedByUserId: token.issuedByUserId,
    scopes: [...token.scopes],
    projectId: token.projectId,
    orchestrationId: token.orchestrationId,
    taskId: token.taskId,
  }
}
