import type { WorkspaceInvitationRepository } from "../application/workspace-invitation-repository"
import type { WorkspaceInvitation } from "../domain/workspace"

export class InMemoryWorkspaceInvitationRepository implements WorkspaceInvitationRepository {
  private readonly invitations = new Map<string, WorkspaceInvitation>()

  async findById(id: string): Promise<WorkspaceInvitation | null> {
    return this.invitations.get(id) ?? null
  }

  async findPendingByWorkspaceIdAndGithubLogin(
    workspaceId: string,
    githubLogin: string,
  ): Promise<WorkspaceInvitation | null> {
    const normalizedLogin = githubLogin.trim().toLowerCase()

    for (const invitation of this.invitations.values()) {
      if (
        invitation.workspaceId === workspaceId &&
        invitation.inviteeGithubLogin === normalizedLogin &&
        invitation.status === "pending"
      ) {
        return invitation
      }
    }

    return null
  }

  async listByWorkspaceId(workspaceId: string): Promise<WorkspaceInvitation[]> {
    return Array.from(this.invitations.values())
      .filter((invitation) => invitation.workspaceId === workspaceId)
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
  }

  async listPendingByGithubLogin(
    githubLogin: string,
  ): Promise<WorkspaceInvitation[]> {
    const normalizedLogin = githubLogin.trim().toLowerCase()
    return Array.from(this.invitations.values())
      .filter(
        (invitation) =>
          invitation.inviteeGithubLogin === normalizedLogin &&
          invitation.status === "pending",
      )
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
  }

  async save(invitation: WorkspaceInvitation): Promise<void> {
    this.invitations.set(invitation.id, invitation)
  }
}
