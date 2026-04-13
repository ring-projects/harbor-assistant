import type { AuthorizationAction } from "./actions"
import type {
  AuthorizationPolicyEffect,
  ProjectRoleKey,
  WorkspaceRoleKey,
} from "./policy-types"

export interface AuthorizationPolicyProvider {
  getDerivedProjectAction(action: AuthorizationAction): AuthorizationAction | null
  getWorkspaceRoleEffect(
    role: WorkspaceRoleKey,
    action: AuthorizationAction,
  ): AuthorizationPolicyEffect | null
  getProjectRoleEffect(
    role: ProjectRoleKey,
    action: AuthorizationAction,
  ): AuthorizationPolicyEffect | null
}
