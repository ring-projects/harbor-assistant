export type RootPathProjectSource = {
  type: "rootPath"
  rootPath: string
  normalizedPath: string
}

export type GitProjectSource = {
  type: "git"
  repositoryUrl: string
  branch: string | null
}

export type ProjectSource = RootPathProjectSource | GitProjectSource

export type GitHubInstallation = {
  id: string
  accountType: "user" | "organization"
  accountLogin: string
  targetType: "selected" | "all"
  status: "active" | "suspended" | "deleted"
}

export type GitHubRepository = {
  nodeId: string
  owner: string
  name: string
  fullName: string
  url: string
  defaultBranch: string | null
  visibility: "public" | "private" | "internal" | null
}

export type ProjectRepositoryBinding = {
  projectId: string
  provider: "github"
  installationId: string
  repositoryOwner: string
  repositoryName: string
  repositoryFullName: string
  repositoryUrl: string
  defaultBranch: string | null
  visibility: "public" | "private" | "internal" | null
  workspaceState: "unprovisioned" | "ready"
}

export type Project = {
  id: string
  workspaceId: string | null
  slug: string
  name: string
  description: string | null
  source: ProjectSource
  rootPath: string | null
  normalizedPath: string | null
  status: "active" | "archived" | "missing"
  archivedAt: string | null
  lastOpenedAt: string | null
  createdAt: string
  updatedAt: string
  settings: ProjectSettings
}

export type ProjectRetentionPolicy = {
  logRetentionDays: number | null
  eventRetentionDays: number | null
}

export type ProjectSkillPolicy = {
  harborSkillsEnabled: boolean
  harborSkillProfile: string | null
}

export type ProjectSettings = {
  retention: ProjectRetentionPolicy
  skills: ProjectSkillPolicy
}
