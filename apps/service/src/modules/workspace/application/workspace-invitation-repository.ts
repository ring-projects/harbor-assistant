import type { WorkspaceInvitation } from "../domain/workspace"

export interface WorkspaceInvitationRepository {
  findById(id: string): Promise<WorkspaceInvitation | null>
  findPendingByWorkspaceIdAndGithubLogin(
    workspaceId: string,
    githubLogin: string,
  ): Promise<WorkspaceInvitation | null>
  listByWorkspaceId(workspaceId: string): Promise<WorkspaceInvitation[]>
  listPendingByGithubLogin(githubLogin: string): Promise<WorkspaceInvitation[]>
  save(invitation: WorkspaceInvitation): Promise<void>
}
