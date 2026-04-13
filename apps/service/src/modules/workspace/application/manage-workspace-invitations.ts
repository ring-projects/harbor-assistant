import { randomUUID } from "node:crypto"

import {
  acceptWorkspaceInvitation,
  addWorkspaceMember,
  createWorkspaceInvitation,
} from "../domain/workspace"
import { createWorkspaceError } from "../errors"
import type { UserDirectory } from "../../user"
import type { WorkspaceInvitationRepository } from "./workspace-invitation-repository"
import type { WorkspaceRepository } from "./workspace-repository"
import {
  requireWorkspaceForMember,
  requireWorkspaceForOwner,
} from "./workspace-access"

export async function listWorkspaceInvitationsForUserUseCase(
  deps: {
    workspaceRepository: WorkspaceRepository
    invitationRepository: WorkspaceInvitationRepository
  },
  input: {
    workspaceId: string
    actorUserId: string
  },
) {
  await requireWorkspaceForOwner(deps.workspaceRepository, {
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    errorMessage: "only workspace owners can manage invitations",
  })

  return deps.invitationRepository.listByWorkspaceId(input.workspaceId)
}

export async function createWorkspaceInvitationUseCase(
  deps: {
    workspaceRepository: WorkspaceRepository
    invitationRepository: WorkspaceInvitationRepository
    userDirectory?: UserDirectory
  },
  input: {
    workspaceId: string
    actorUserId: string
    inviteeGithubLogin: string
    idGenerator?: () => string
    now?: Date
  },
) {
  const workspace = await requireWorkspaceForOwner(deps.workspaceRepository, {
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    errorMessage: "only workspace owners can manage invitations",
  })
  const normalizedLogin = input.inviteeGithubLogin.trim().toLowerCase()

  const existingInvitation =
    await deps.invitationRepository.findPendingByWorkspaceIdAndGithubLogin(
      input.workspaceId,
      normalizedLogin,
    )
  if (existingInvitation) {
    return existingInvitation
  }

  const existingUser = deps.userDirectory
    ? await deps.userDirectory.findByGithubLogin(normalizedLogin)
    : null
  if (
    existingUser &&
    workspace.memberships.some(
      (membership) =>
        membership.userId === existingUser.id && membership.status === "active",
    )
  ) {
    throw createWorkspaceError().invalidState(
      "user is already an active workspace member",
    )
  }

  const invitation = createWorkspaceInvitation(workspace, {
    id: input.idGenerator?.() ?? randomUUID(),
    inviteeGithubLogin: normalizedLogin,
    invitedByUserId: input.actorUserId,
    now: input.now,
  })
  await deps.invitationRepository.save(invitation)
  return invitation
}

export async function acceptWorkspaceInvitationUseCase(
  deps: {
    workspaceRepository: WorkspaceRepository
    invitationRepository: WorkspaceInvitationRepository
  },
  input: {
    invitationId: string
    actorUserId: string
    actorGithubLogin: string
    now?: Date
  },
) {
  const invitation = await deps.invitationRepository.findById(input.invitationId)
  if (!invitation) {
    throw createWorkspaceError().notFound("workspace invitation not found")
  }

  if (
    invitation.inviteeGithubLogin !== input.actorGithubLogin.trim().toLowerCase()
  ) {
    throw createWorkspaceError().invalidState(
      "workspace invitation does not belong to the current user",
    )
  }

  const workspace = await deps.workspaceRepository.findById(invitation.workspaceId)
  if (!workspace) {
    throw createWorkspaceError().notFound()
  }

  const acceptedInvitation = acceptWorkspaceInvitation(
    invitation,
    {
      acceptedByUserId: input.actorUserId,
    },
    input.now,
  )
  const nextWorkspace = addWorkspaceMember(
    workspace,
    {
      userId: input.actorUserId,
    },
    input.now,
  )

  await deps.workspaceRepository.save(nextWorkspace)
  await deps.invitationRepository.save(acceptedInvitation)

  return {
    workspace: nextWorkspace,
    invitation: acceptedInvitation,
  }
}

export async function acceptPendingWorkspaceInvitationsForGithubLoginUseCase(
  deps: {
    workspaceRepository: WorkspaceRepository
    invitationRepository: WorkspaceInvitationRepository
  },
  input: {
    actorUserId: string
    actorGithubLogin: string
    now?: Date
  },
) {
  const invitations = await deps.invitationRepository.listPendingByGithubLogin(
    input.actorGithubLogin,
  )
  const results = []

  for (const invitation of invitations) {
    results.push(
      await acceptWorkspaceInvitationUseCase(deps, {
        invitationId: invitation.id,
        actorUserId: input.actorUserId,
        actorGithubLogin: input.actorGithubLogin,
        now: input.now,
      }),
    )
  }

  return results
}
