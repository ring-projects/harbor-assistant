import type { AuthorizationAction } from "./actions"
import {
  DERIVED_PROJECT_ACTIONS,
  PROJECT_ACTION_TABLE,
  WORKSPACE_ACTION_TABLE,
} from "./action-table"
import type { AuthorizationPolicyProvider } from "./policy-provider"
import type {
  AuthorizationPolicyEffect,
  ProjectRoleKey,
  WorkspaceRoleKey,
} from "./policy-types"

function readPolicyEffect<RoleKey extends string>(
  table: Record<AuthorizationAction, Partial<Record<RoleKey, AuthorizationPolicyEffect>>>,
  role: RoleKey,
  action: AuthorizationAction,
): AuthorizationPolicyEffect | null {
  return table[action][role] ?? null
}

export function createStaticAuthorizationPolicyProvider(): AuthorizationPolicyProvider {
  return {
    getDerivedProjectAction(action) {
      return DERIVED_PROJECT_ACTIONS[action] ?? null
    },
    getWorkspaceRoleEffect(role, action) {
      return readPolicyEffect(WORKSPACE_ACTION_TABLE, role, action)
    },
    getProjectRoleEffect(role, action) {
      return readPolicyEffect(PROJECT_ACTION_TABLE, role, action)
    },
  }
}
