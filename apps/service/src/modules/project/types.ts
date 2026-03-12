/**
 * Project domain types
 */
export type Project = {
  id: string
  name: string
  slug: string | null
  rootPath: string
  normalizedPath: string
  description: string | null
  status: ProjectStatus
  lastOpenedAt: Date | null
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
  // Convenience alias for normalizedPath (commonly used in codebase)
  path: string
}

export type ProjectStatus = "active" | "archived" | "missing"

export type ProjectWithSettings = Project & {
  settings: ProjectSettings | null
}

export type ProjectSettings = {
  projectId: string
  defaultExecutor: string | null
  defaultModel: string | null
  defaultExecutionMode: string | null
  maxConcurrentTasks: number
  logRetentionDays: number | null
  eventRetentionDays: number | null
  createdAt: Date
  updatedAt: Date
}
