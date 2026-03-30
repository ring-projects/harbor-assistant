import type { Project as PrismaProject } from "@prisma/client"

import {
  deriveProjectSlug,
  type Project,
  type ProjectSettings,
} from "../../domain/project"

export function toDomainProjectSettings(
  project: PrismaProject,
): ProjectSettings {
  return {
    execution: {
      defaultExecutor: project.defaultExecutor ?? null,
      defaultModel: project.defaultModel ?? null,
      defaultExecutionMode: project.defaultExecutionMode ?? null,
      maxConcurrentTasks: project.maxConcurrentTasks,
    },
    retention: {
      logRetentionDays: project.logRetentionDays ?? 30,
      eventRetentionDays: project.eventRetentionDays ?? 7,
    },
    skills: {
      harborSkillsEnabled: project.harborSkillsEnabled,
      harborSkillProfile: project.harborSkillProfile ?? "default",
    },
  }
}

export function toDomainProject(project: PrismaProject): Project {
  return {
    id: project.id,
    slug: project.slug ?? deriveProjectSlug(project.name),
    name: project.name,
    description: project.description,
    rootPath: project.rootPath,
    normalizedPath: project.normalizedPath,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    archivedAt: project.archivedAt,
    lastOpenedAt: project.lastOpenedAt,
    settings: toDomainProjectSettings(project),
  }
}
