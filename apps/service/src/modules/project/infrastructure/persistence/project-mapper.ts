import type { Project as PrismaProject } from "@prisma/client"

import {
  deriveProjectSlug,
  type Project,
  type ProjectSource,
  type ProjectSettings,
} from "../../domain/project"

export function toDomainProjectSettings(
  project: PrismaProject,
): ProjectSettings {
  return {
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
  const source: ProjectSource =
    project.sourceType === "git"
      ? {
          type: "git",
          repositoryUrl: project.sourceRepositoryUrl ?? "",
          branch: project.sourceGitBranch,
        }
      : {
          type: "rootPath",
          rootPath: project.rootPath ?? "",
          normalizedPath: project.normalizedPath ?? "",
        }

  return {
    id: project.id,
    ownerUserId: project.ownerUserId,
    slug: project.slug ?? deriveProjectSlug(project.name),
    name: project.name,
    description: project.description,
    source,
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
