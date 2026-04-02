import type { ProjectRepositoryBinding as PrismaProjectRepositoryBinding } from "@prisma/client"

import type { ProjectRepositoryBinding } from "../../application/project-repository-binding-repository"

export function toDomainProjectRepositoryBinding(
  binding: PrismaProjectRepositoryBinding,
): ProjectRepositoryBinding {
  return {
    projectId: binding.projectId,
    provider: binding.provider,
    installationId: binding.installationId,
    repositoryNodeId: binding.repositoryNodeId,
    repositoryOwner: binding.repositoryOwner,
    repositoryName: binding.repositoryName,
    repositoryFullName: binding.repositoryFullName,
    repositoryUrl: binding.repositoryUrl,
    defaultBranch: binding.defaultBranch,
    visibility: binding.visibility,
    createdAt: binding.createdAt,
    updatedAt: binding.updatedAt,
    lastVerifiedAt: binding.lastVerifiedAt,
  }
}
