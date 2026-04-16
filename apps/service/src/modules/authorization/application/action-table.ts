import type { AuthorizationAction } from "./actions"
import type {
  ActionPolicyTable,
  ProjectRoleKey,
  WorkspaceRoleKey,
} from "./policy-types"

export const DERIVED_PROJECT_ACTIONS: Partial<
  Record<AuthorizationAction, AuthorizationAction>
> = {
  "task.view": "project.tasks.read",
  "task.events.read": "project.tasks.read",
  "task.subscribe": "project.tasks.read",
  "task.update": "project.tasks.create",
  "task.cancel": "project.tasks.create",
  "task.resume": "project.tasks.create",
  "task.delete": "project.tasks.create",
  "orchestration.view": "project.view",
  "orchestration.create": "project.tasks.create",
  "orchestration.task.create": "project.tasks.create",
}

export const WORKSPACE_ACTION_TABLE: ActionPolicyTable<WorkspaceRoleKey> = {
  "workspace.view": {
    workspace_owner: "allow",
    workspace_member: "allow",
  },
  "workspace.members.read": {
    workspace_owner: "allow",
    workspace_member: "allow",
  },
  "workspace.members.manage": {
    workspace_owner: "allow",
    workspace_member: "deny",
  },
  "workspace.invitations.read": {
    workspace_owner: "allow",
    workspace_member: "deny",
  },
  "workspace.invitations.manage": {
    workspace_owner: "allow",
    workspace_member: "deny",
  },
  "workspace.integrations.github.read": {
    workspace_owner: "allow",
    workspace_member: "allow",
  },
  "workspace.integrations.github.manage": {
    workspace_owner: "allow",
    workspace_member: "deny",
  },
  "project.view": {},
  "project.create": {
    workspace_owner: "allow",
    workspace_member: "deny",
  },
  "project.update": {},
  "project.archive": {},
  "project.restore": {},
  "project.delete": {},
  "project.settings.read": {},
  "project.settings.update": {},
  "project.repository_binding.read": {},
  "project.repository_binding.write": {},
  "project.local_path.provision": {},
  "project.local_path.sync": {},
  "project.files.read": {},
  "project.files.write": {},
  "project.git.read": {},
  "project.git.write": {},
  "project.git.subscribe": {},
  "project.tasks.read": {},
  "project.tasks.create": {},
  "task.view": {},
  "task.update": {},
  "task.cancel": {},
  "task.resume": {},
  "task.delete": {},
  "task.events.read": {},
  "task.subscribe": {},
  "orchestration.view": {},
  "orchestration.create": {},
  "orchestration.task.create": {},
}

export const PROJECT_ACTION_TABLE: ActionPolicyTable<ProjectRoleKey> = {
  "workspace.view": {},
  "workspace.members.read": {},
  "workspace.members.manage": {},
  "workspace.invitations.read": {},
  "workspace.invitations.manage": {},
  "workspace.integrations.github.read": {},
  "workspace.integrations.github.manage": {},
  "project.view": {
    workspace_owner: "allow",
    workspace_member: "allow",
    legacy_project_owner: "allow",
  },
  "project.create": {},
  "project.update": {
    workspace_owner: "allow",
    workspace_member: "deny",
    legacy_project_owner: "allow",
  },
  "project.archive": {
    workspace_owner: "allow",
    workspace_member: "deny",
    legacy_project_owner: "allow",
  },
  "project.restore": {
    workspace_owner: "allow",
    workspace_member: "deny",
    legacy_project_owner: "allow",
  },
  "project.delete": {
    workspace_owner: "allow",
    workspace_member: "deny",
    legacy_project_owner: "allow",
  },
  "project.settings.read": {
    workspace_owner: "allow",
    workspace_member: "allow",
    legacy_project_owner: "allow",
  },
  "project.settings.update": {
    workspace_owner: "allow",
    workspace_member: "deny",
    legacy_project_owner: "allow",
  },
  "project.repository_binding.read": {
    workspace_owner: "allow",
    workspace_member: "allow",
    legacy_project_owner: "allow",
  },
  "project.repository_binding.write": {
    workspace_owner: "allow",
    workspace_member: "deny",
    legacy_project_owner: "allow",
  },
  "project.local_path.provision": {
    workspace_owner: "allow",
    workspace_member: "deny",
    legacy_project_owner: "allow",
  },
  "project.local_path.sync": {
    workspace_owner: "allow",
    workspace_member: "deny",
    legacy_project_owner: "allow",
  },
  "project.files.read": {
    workspace_owner: "allow",
    workspace_member: "allow",
    legacy_project_owner: "allow",
  },
  "project.files.write": {
    workspace_owner: "allow",
    workspace_member: "deny",
    legacy_project_owner: "allow",
  },
  "project.git.read": {
    workspace_owner: "allow",
    workspace_member: "allow",
    legacy_project_owner: "allow",
  },
  "project.git.write": {
    workspace_owner: "allow",
    workspace_member: "deny",
    legacy_project_owner: "allow",
  },
  "project.git.subscribe": {
    workspace_owner: "allow",
    workspace_member: "allow",
    legacy_project_owner: "allow",
  },
  "project.tasks.read": {
    workspace_owner: "allow",
    workspace_member: "allow",
    legacy_project_owner: "allow",
  },
  "project.tasks.create": {
    workspace_owner: "allow",
    workspace_member: "allow",
    legacy_project_owner: "allow",
  },
  "task.view": {},
  "task.update": {},
  "task.cancel": {},
  "task.resume": {},
  "task.delete": {},
  "task.events.read": {},
  "task.subscribe": {},
  "orchestration.view": {},
  "orchestration.create": {},
  "orchestration.task.create": {},
}
