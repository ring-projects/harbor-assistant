export type GitHubInstallationRecord = {
  id: string
  accountType: "user" | "organization"
  accountLogin: string
  targetType: "selected" | "all"
  status: "active" | "suspended" | "deleted"
}

export type GitHubInstallationRepositorySummary = {
  nodeId: string | null
  owner: string
  name: string
  fullName: string
  url: string
  defaultBranch: string | null
  visibility: "public" | "private" | "internal" | null
}

export type GitHubInstallationAccessToken = {
  token: string
  expiresAt: Date
}

export interface GitHubAppClient {
  buildInstallUrl(state?: string): string
  getInstallation(installationId: string): Promise<GitHubInstallationRecord>
  listInstallationRepositories(
    installationId: string,
  ): Promise<GitHubInstallationRepositorySummary[]>
  createInstallationAccessToken(
    installationId: string,
  ): Promise<GitHubInstallationAccessToken>
}
