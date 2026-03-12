export type Project = {
  id: string
  name: string
  slug: string | null
  rootPath: string
  normalizedPath: string
  description: string | null
  status: "active" | "archived" | "missing"
  lastOpenedAt: string | null
  updatedAt: string
  archivedAt: string | null
  path: string
  createdAt: string
}

export type ProjectExecutor = "codex" | "claude-code"

export type ProjectExecutionMode = "safe" | "connected" | "full-access"

export type ProjectSettings = {
  projectId: string
  defaultExecutor: ProjectExecutor | null
  defaultModel: string | null
  defaultExecutionMode: ProjectExecutionMode | null
  maxConcurrentTasks: number
  logRetentionDays: number | null
  eventRetentionDays: number | null
  createdAt: string
  updatedAt: string
}
