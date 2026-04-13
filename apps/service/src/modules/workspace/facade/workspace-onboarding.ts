import { ensurePersonalWorkspaceUseCase } from "../application/ensure-personal-workspace"
import { acceptPendingWorkspaceInvitationsForGithubLoginUseCase } from "../application/manage-workspace-invitations"
import type { WorkspaceInvitationRepository } from "../application/workspace-invitation-repository"
import type { WorkspaceRepository } from "../application/workspace-repository"

export async function bootstrapWorkspaceOnLogin(
  deps: {
    workspaceRepository: WorkspaceRepository
    invitationRepository: WorkspaceInvitationRepository
  },
  input: {
    userId: string
    githubLogin: string
    fallbackName: string
    now?: Date
  },
) {
  const personalWorkspace = await ensurePersonalWorkspaceUseCase(
    deps.workspaceRepository,
    {
      userId: input.userId,
      fallbackName: input.fallbackName,
      now: input.now,
    },
  )
  const acceptedInvitations =
    await acceptPendingWorkspaceInvitationsForGithubLoginUseCase(
      {
        workspaceRepository: deps.workspaceRepository,
        invitationRepository: deps.invitationRepository,
      },
      {
        actorUserId: input.userId,
        actorGithubLogin: input.githubLogin,
        now: input.now,
      },
    )

  return {
    personalWorkspace,
    acceptedInvitations,
  }
}
