export type Project = {
  id: string
  slug: string
  name: string
  description: string | null
  rootPath: string
  normalizedPath: string
  status: "active" | "archived" | "missing"
  archivedAt: string | null
  lastOpenedAt: string | null
  createdAt: string
  updatedAt: string
  settings: ProjectSettings
}

export type ProjectExecutor = "codex" | "claude-code"

export type ProjectExecutionMode = "safe" | "connected" | "full-access"

export type ProjectExecutionPolicy = {
  defaultExecutor: ProjectExecutor | null
  defaultModel: string | null
  defaultExecutionMode: ProjectExecutionMode | null
  maxConcurrentTasks: number
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
  execution: ProjectExecutionPolicy
  retention: ProjectRetentionPolicy
  skills: ProjectSkillPolicy
}
