export type WorkspaceGitHubInstallationLink = {
  workspaceId: string
  installationId: string
  linkedByUserId: string
  createdAt: Date
  updatedAt: Date
}

export interface WorkspaceInstallationRepository {
  findLink(
    workspaceId: string,
    installationId: string,
  ): Promise<WorkspaceGitHubInstallationLink | null>
  listLinksByWorkspaceId(
    workspaceId: string,
  ): Promise<WorkspaceGitHubInstallationLink[]>
  saveLink(link: WorkspaceGitHubInstallationLink): Promise<void>
}
