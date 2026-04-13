import type { AuthorizationAction } from "./actions"

export type AuthorizationPolicyEffect = "allow" | "deny"

export type WorkspaceRoleKey = "workspace_owner" | "workspace_member"

export type ProjectRoleKey =
  | "workspace_owner"
  | "workspace_member"
  | "legacy_project_owner"

export type ActionPolicyTable<RoleKey extends string> = Record<
  AuthorizationAction,
  Partial<Record<RoleKey, AuthorizationPolicyEffect>>
>
