import type { AuthorizationAction } from "./actions"

export type AuthorizationActor =
  | {
      kind: "user"
      userId: string
    }
  | {
      kind: "agent"
      tokenId: string
      issuedByUserId: string | null
      scopes: AuthorizationAction[]
      projectId: string | null
      orchestrationId: string | null
      taskId: string | null
    }
  | {
      kind: "system"
      systemId: string
    }

export type AuthorizationResource =
  | {
      kind: "workspace"
      workspaceId: string
    }
  | {
      kind: "project"
      projectId: string
    }
  | {
      kind: "task"
      taskId: string
    }
  | {
      kind: "orchestration"
      orchestrationId: string
    }

export type AuthorizationDecisionReason =
  | "resource_not_found"
  | "resource_not_visible"
  | "permission_denied"
  | "actor_invalid"

export type AuthorizationAllowDecision = {
  effect: "allow"
  actor: AuthorizationActor
  action: AuthorizationAction
  resource: AuthorizationResource
}

export type AuthorizationDenyDecision = {
  effect: "deny"
  actor: AuthorizationActor
  action: AuthorizationAction
  resource: AuthorizationResource
  reason: AuthorizationDecisionReason
  httpStatus: 401 | 403 | 404
}

export type AuthorizationDecision =
  | AuthorizationAllowDecision
  | AuthorizationDenyDecision

export type AuthorizationInput = {
  actor: AuthorizationActor
  action: AuthorizationAction
  resource: AuthorizationResource
}

export interface AuthorizationService {
  authorize(input: AuthorizationInput): Promise<AuthorizationDecision>
  requireAuthorized(input: AuthorizationInput): Promise<void>
}
