import { createProjectError, ProjectError } from "../errors"

export type ProjectStatus = "active" | "archived" | "missing"

export type ProjectExecutionPolicy = {
  defaultExecutor: string | null
  defaultModel: string | null
  defaultExecutionMode: string | null
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

export type Project = {
  id: string
  slug: string
  name: string
  description: string | null
  rootPath: string
  normalizedPath: string
  status: ProjectStatus
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
  lastOpenedAt: Date | null
  settings: ProjectSettings
}

export type CreateProjectInput = {
  id: string
  name: string
  normalizedPath: string
  rootPath?: string
  description?: string | null
  now?: Date
}

export type UpdateProjectSettingsInput = Partial<{
  execution: Partial<ProjectExecutionPolicy>
  retention: Partial<ProjectRetentionPolicy>
  skills: Partial<ProjectSkillPolicy>
}>

export type UpdateProjectProfileInput = {
  name?: string
  description?: string | null
}

export function deriveProjectSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const DEFAULT_SETTINGS: ProjectSettings = {
  execution: {
    defaultExecutor: null,
    defaultModel: null,
    defaultExecutionMode: null,
    maxConcurrentTasks: 1,
  },
  retention: {
    logRetentionDays: 30,
    eventRetentionDays: 7,
  },
  skills: {
    harborSkillsEnabled: false,
    harborSkillProfile: "default",
  },
}

function requireNonEmpty(value: string, field: string) {
  if (!value.trim()) {
    throw createProjectError().invalidInput(`${field} is required`)
  }
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw createProjectError().invalidInput(`${field} must be a positive integer`)
  }
}

function assertNullablePositiveInteger(value: number | null, field: string) {
  if (value === null) {
    return
  }

  assertPositiveInteger(value, field)
}

function validateSettings(settings: ProjectSettings) {
  assertPositiveInteger(
    settings.execution.maxConcurrentTasks,
    "maxConcurrentTasks",
  )
  assertNullablePositiveInteger(settings.retention.logRetentionDays, "logRetentionDays")
  assertNullablePositiveInteger(
    settings.retention.eventRetentionDays,
    "eventRetentionDays",
  )

  if (
    settings.execution.defaultModel &&
    !settings.execution.defaultExecutor
  ) {
    throw createProjectError().invalidInput(
      "defaultModel requires defaultExecutor to be set",
    )
  }
}

export function createProject(input: CreateProjectInput): Project {
  requireNonEmpty(input.id, "id")
  requireNonEmpty(input.name, "name")
  requireNonEmpty(input.normalizedPath, "normalizedPath")

  const now = input.now ?? new Date()
  const trimmedName = input.name.trim()
  const normalizedPath = input.normalizedPath.trim()
  const slug = deriveProjectSlug(trimmedName)

  if (!slug) {
    throw createProjectError().invalidInput("slug cannot be empty")
  }

  const project: Project = {
    id: input.id.trim(),
    slug,
    name: trimmedName,
    description: input.description ?? null,
    rootPath: input.rootPath?.trim() || normalizedPath,
    normalizedPath,
    status: "active",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    lastOpenedAt: null,
    settings: structuredClone(DEFAULT_SETTINGS),
  }

  validateSettings(project.settings)
  return project
}

export function updateProjectSettings(
  project: Project,
  input: UpdateProjectSettingsInput,
  now = new Date(),
): Project {
  const next: Project = {
    ...project,
    updatedAt: now,
    settings: {
      execution: {
        ...project.settings.execution,
        ...input.execution,
      },
      retention: {
        ...project.settings.retention,
        ...input.retention,
      },
      skills: {
        ...project.settings.skills,
        ...input.skills,
      },
    },
  }

  validateSettings(next.settings)
  return next
}

export function archiveProject(project: Project, now = new Date()): Project {
  if (project.status === "archived") {
    throw createProjectError().invalidState("project is already archived")
  }

  return {
    ...project,
    status: "archived",
    archivedAt: now,
    updatedAt: now,
  }
}

export function restoreProject(project: Project, now = new Date()): Project {
  if (project.status === "active") {
    throw createProjectError().invalidState("project is already active")
  }

  return {
    ...project,
    status: "active",
    archivedAt: null,
    updatedAt: now,
  }
}

export function updateProjectProfile(
  project: Project,
  input: UpdateProjectProfileInput,
  now = new Date(),
): Project {
  const nextName = typeof input.name === "string" ? input.name.trim() : project.name
  requireNonEmpty(nextName, "name")

  const nextSlug = deriveProjectSlug(nextName)

  if (!nextSlug) {
    throw createProjectError().invalidInput("slug cannot be empty")
  }

  return {
    ...project,
    name: nextName,
    slug: nextSlug,
    description:
      input.description === undefined ? project.description : input.description,
    updatedAt: now,
  }
}

export function relocateProjectRoot(
  project: Project,
  input: {
    normalizedPath: string
    rootPath?: string
  },
  now = new Date(),
): Project {
  requireNonEmpty(input.normalizedPath, "normalizedPath")

  return {
    ...project,
    normalizedPath: input.normalizedPath.trim(),
    rootPath: input.rootPath?.trim() || input.normalizedPath.trim(),
    updatedAt: now,
  }
}
