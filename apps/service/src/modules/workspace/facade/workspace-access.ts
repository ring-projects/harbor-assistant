import { ensurePersonalWorkspaceUseCase } from "../application/ensure-personal-workspace"
import {
  findWorkspaceForActiveMember,
  hasActiveWorkspaceMembership,
} from "../application/workspace-access"
import type { WorkspaceRepository } from "../application/workspace-repository"
import type { Workspace } from "../domain/workspace"

export function canUserAccessWorkspace(
  workspace: Workspace,
  userId: string,
): boolean {
  return hasActiveWorkspaceMembership(workspace, userId)
}

export async function findWorkspaceAccessibleToUser(
  repository: WorkspaceRepository,
  input: {
    workspaceId: string
    userId: string
  },
): Promise<Workspace | null> {
  return findWorkspaceForActiveMember(repository, input)
}

export async function resolveWorkspaceForUser(
  repository: WorkspaceRepository,
  input: {
    workspaceId?: string | null
    userId: string
    fallbackName: string
    now?: Date
  },
): Promise<Workspace | null> {
  const requestedWorkspaceId = input.workspaceId?.trim()
  if (!requestedWorkspaceId) {
    return ensurePersonalWorkspaceUseCase(repository, {
      userId: input.userId,
      fallbackName: input.fallbackName,
      now: input.now,
    })
  }

  return findWorkspaceForActiveMember(repository, {
    workspaceId: requestedWorkspaceId,
    userId: input.userId,
  })
}
