import { createProjectError, ProjectError } from "../errors"

export type ProjectStatus = "active" | "archived" | "missing"

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

export type Project = {
  id: string
  ownerUserId: string | null
  slug: string
  name: string
  description: string | null
  source: ProjectSource
  rootPath: string | null
  normalizedPath: string | null
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
  ownerUserId?: string | null
  description?: string | null
  now?: Date
} & (
  | {
      source: RootPathProjectSource
    }
  | {
      source: {
        type: "git"
        repositoryUrl: string
        branch?: string | null
      }
    }
  | {
      normalizedPath: string
      rootPath?: string
    }
)

export type UpdateProjectSettingsInput = Partial<{
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

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeProjectSource(input: CreateProjectInput): {
  source: ProjectSource
  rootPath: string | null
  normalizedPath: string | null
} {
  if ("source" in input) {
    if (input.source.type === "rootPath") {
      requireNonEmpty(input.source.rootPath, "rootPath")
      requireNonEmpty(input.source.normalizedPath, "normalizedPath")

      const rootPath = input.source.rootPath.trim()
      const normalizedPath = input.source.normalizedPath.trim()

      return {
        source: {
          type: "rootPath",
          rootPath,
          normalizedPath,
        },
        rootPath,
        normalizedPath,
      }
    }

    requireNonEmpty(input.source.repositoryUrl, "repositoryUrl")

    return {
      source: {
        type: "git",
        repositoryUrl: input.source.repositoryUrl.trim(),
        branch: normalizeOptionalString(input.source.branch),
      },
      rootPath: null,
      normalizedPath: null,
    }
  }

  requireNonEmpty(input.normalizedPath, "normalizedPath")
  const normalizedPath = input.normalizedPath.trim()
  const rootPath = input.rootPath?.trim() || normalizedPath

  return {
    source: {
      type: "rootPath",
      rootPath,
      normalizedPath,
    },
    rootPath,
    normalizedPath,
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
  assertNullablePositiveInteger(settings.retention.logRetentionDays, "logRetentionDays")
  assertNullablePositiveInteger(
    settings.retention.eventRetentionDays,
    "eventRetentionDays",
  )
}

export function createProject(input: CreateProjectInput): Project {
  requireNonEmpty(input.id, "id")
  requireNonEmpty(input.name, "name")

  const now = input.now ?? new Date()
  const trimmedName = input.name.trim()
  const slug = deriveProjectSlug(trimmedName)
  const normalizedSource = normalizeProjectSource(input)

  if (!slug) {
    throw createProjectError().invalidInput("slug cannot be empty")
  }

  const project: Project = {
    id: input.id.trim(),
    ownerUserId: input.ownerUserId?.trim() || null,
    slug,
    name: trimmedName,
    description: input.description ?? null,
    source: normalizedSource.source,
    rootPath: normalizedSource.rootPath,
    normalizedPath: normalizedSource.normalizedPath,
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
  if (project.source.type !== "rootPath") {
    throw createProjectError().invalidState(
      "only rootPath projects can update their root path",
    )
  }

  requireNonEmpty(input.normalizedPath, "normalizedPath")

  const normalizedPath = input.normalizedPath.trim()
  const rootPath = input.rootPath?.trim() || normalizedPath

  return {
    ...project,
    source: {
      type: "rootPath",
      rootPath,
      normalizedPath,
    },
    normalizedPath,
    rootPath,
    updatedAt: now,
  }
}

export function attachProjectWorkspace(
  project: Project,
  input: {
    normalizedPath: string
    rootPath?: string
  },
  now = new Date(),
): Project {
  requireNonEmpty(input.normalizedPath, "normalizedPath")

  const normalizedPath = input.normalizedPath.trim()
  const rootPath = input.rootPath?.trim() || normalizedPath

  return {
    ...project,
    rootPath,
    normalizedPath,
    updatedAt: now,
  }
}

export function hasProjectWorkspace(project: Project): project is Project & {
  rootPath: string
  normalizedPath: string
} {
  return Boolean(project.rootPath && project.normalizedPath)
}

export function requireProjectWorkspace(
  project: Project,
  message = "project workspace is not available",
) {
  if (!hasProjectWorkspace(project)) {
    throw createProjectError().invalidState(message)
  }

  return {
    rootPath: project.rootPath,
    normalizedPath: project.normalizedPath,
  }
}
