export type GitHubAppInstallation = {
  id: string
  accountType: "user" | "organization"
  accountLogin: string
  targetType: "selected" | "all"
  status: "active" | "suspended" | "deleted"
  installedByUserId: string | null
  createdAt: Date
  updatedAt: Date
  lastValidatedAt: Date | null
}

export interface GitHubInstallationRepository {
  findById(id: string): Promise<GitHubAppInstallation | null>
  findByIdAndInstalledByUserId(
    id: string,
    installedByUserId: string,
  ): Promise<GitHubAppInstallation | null>
  listByInstalledByUserId(installedByUserId: string): Promise<GitHubAppInstallation[]>
  save(installation: GitHubAppInstallation): Promise<void>
}
