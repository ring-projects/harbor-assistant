import type {
  WorkspaceGitHubInstallationLink,
  WorkspaceInstallationRepository,
} from "../application/workspace-installation-repository"

export class InMemoryWorkspaceInstallationRepository
  implements WorkspaceInstallationRepository
{
  private readonly links = new Map<string, WorkspaceGitHubInstallationLink>()

  private createKey(workspaceId: string, installationId: string) {
    return `${workspaceId}::${installationId}`
  }

  async findLink(
    workspaceId: string,
    installationId: string,
  ): Promise<WorkspaceGitHubInstallationLink | null> {
    return this.links.get(this.createKey(workspaceId, installationId)) ?? null
  }

  async listLinksByWorkspaceId(
    workspaceId: string,
  ): Promise<WorkspaceGitHubInstallationLink[]> {
    return Array.from(this.links.values()).filter(
      (link) => link.workspaceId === workspaceId,
    )
  }

  async saveLink(link: WorkspaceGitHubInstallationLink): Promise<void> {
    this.links.set(this.createKey(link.workspaceId, link.installationId), link)
  }
}
