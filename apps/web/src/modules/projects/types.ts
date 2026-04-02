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

export type Project = {
  id: string
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
