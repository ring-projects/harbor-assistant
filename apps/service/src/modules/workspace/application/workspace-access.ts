import type { Workspace } from "../domain/workspace"
import { createWorkspaceError } from "../errors"
import type { WorkspaceRepository } from "./workspace-repository"

export function hasActiveWorkspaceMembership(
  workspace: Workspace,
  userId: string,
): boolean {
  const normalizedUserId = userId.trim()
  if (!normalizedUserId) {
    return false
  }

  return workspace.memberships.some(
    (membership) =>
      membership.userId === normalizedUserId && membership.status === "active",
  )
}

export function hasWorkspaceOwnerAccess(
  workspace: Workspace,
  userId: string,
): boolean {
  const normalizedUserId = userId.trim()
  if (!normalizedUserId) {
    return false
  }

  return workspace.memberships.some(
    (membership) =>
      membership.userId === normalizedUserId &&
      membership.status === "active" &&
      membership.role === "owner",
  )
}

export async function findWorkspaceForActiveMember(
  repository: WorkspaceRepository,
  input: {
    workspaceId: string
    userId: string
  },
): Promise<Workspace | null> {
  const workspace = await repository.findById(input.workspaceId)
  if (!workspace || !hasActiveWorkspaceMembership(workspace, input.userId)) {
    return null
  }

  return workspace
}

export async function requireWorkspaceForMember(
  repository: WorkspaceRepository,
  input: {
    workspaceId: string
    userId: string
  },
): Promise<Workspace> {
  const workspace = await findWorkspaceForActiveMember(repository, input)
  if (!workspace) {
    throw createWorkspaceError().notFound()
  }

  return workspace
}

export async function requireWorkspaceForOwner(
  repository: WorkspaceRepository,
  input: {
    workspaceId: string
    userId: string
    errorMessage: string
  },
): Promise<Workspace> {
  const workspace = await requireWorkspaceForMember(repository, input)
  if (!hasWorkspaceOwnerAccess(workspace, input.userId)) {
    throw createWorkspaceError().invalidState(input.errorMessage)
  }

  return workspace
}
