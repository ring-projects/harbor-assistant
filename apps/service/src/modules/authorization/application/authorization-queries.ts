export type AuthorizationMembershipRole = "owner" | "member"
export type AuthorizationMembershipStatus = "active" | "removed"
export type AuthorizationProjectStatus = "active" | "archived" | "missing"
export type AuthorizationProjectSourceType = "rootPath" | "git"

export type AuthorizationWorkspaceAccessContext = {
  workspaceId: string
  exists: boolean
  membership: null | {
    role: AuthorizationMembershipRole
    status: AuthorizationMembershipStatus
  }
}

export type AuthorizationProjectContext = {
  projectId: string
  ownerUserId: string | null
  workspaceId: string | null
  status: AuthorizationProjectStatus
  sourceType: AuthorizationProjectSourceType
  hasWorkspaceRoot: boolean
}

export type AuthorizationTaskContext = {
  taskId: string
  projectId: string
  orchestrationId: string
}

export type AuthorizationOrchestrationContext = {
  orchestrationId: string
  projectId: string
}

export interface AuthorizationWorkspaceQuery {
  getWorkspaceAccessContext(
    workspaceId: string,
    actorUserId: string,
  ): Promise<AuthorizationWorkspaceAccessContext>
}

export interface AuthorizationProjectQuery {
  getProjectAuthorizationContext(
    projectId: string,
  ): Promise<AuthorizationProjectContext | null>
}

export interface AuthorizationTaskQuery {
  getTaskAuthorizationContext(
    taskId: string,
  ): Promise<AuthorizationTaskContext | null>
}

export interface AuthorizationOrchestrationQuery {
  getOrchestrationAuthorizationContext(
    orchestrationId: string,
  ): Promise<AuthorizationOrchestrationContext | null>
}
