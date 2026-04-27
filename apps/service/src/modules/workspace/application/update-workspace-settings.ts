import { updateWorkspaceSettings } from "../domain/workspace"
import type { WorkspaceRepository } from "./workspace-repository"
import { requireWorkspaceForOwner } from "./workspace-access"

export async function getWorkspaceSettingsForUserUseCase(
  repository: WorkspaceRepository,
  input: {
    workspaceId: string
    actorUserId: string
  },
) {
  const workspace = await requireWorkspaceForOwner(repository, {
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    errorMessage: "only workspace owners can read settings",
  })

  return workspace.settings
}

export async function updateWorkspaceSettingsUseCase(
  repository: WorkspaceRepository,
  input: {
    workspaceId: string
    actorUserId: string
    changes: Parameters<typeof updateWorkspaceSettings>[1]
    now?: Date
  },
) {
  const workspace = await requireWorkspaceForOwner(repository, {
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    errorMessage: "only workspace owners can update settings",
  })

  const next = updateWorkspaceSettings(workspace, input.changes, input.now)
  await repository.save(next)
  return next
}
