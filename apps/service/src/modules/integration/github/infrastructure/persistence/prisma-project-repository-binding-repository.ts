import type { PrismaClient } from "@prisma/client"

import type {
  ProjectRepositoryBinding,
  ProjectRepositoryBindingRepository,
} from "../../application/project-repository-binding-repository"
import { toDomainProjectRepositoryBinding } from "./project-repository-binding-mapper"

export class PrismaProjectRepositoryBindingRepository implements ProjectRepositoryBindingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProjectId(
    projectId: string,
  ): Promise<ProjectRepositoryBinding | null> {
    const binding = await this.prisma.projectRepositoryBinding.findUnique({
      where: {
        projectId,
      },
    })

    return binding ? toDomainProjectRepositoryBinding(binding) : null
  }

  async save(binding: ProjectRepositoryBinding): Promise<void> {
    await this.prisma.projectRepositoryBinding.upsert({
      where: {
        projectId: binding.projectId,
      },
      create: {
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
      },
      update: {
        provider: binding.provider,
        installationId: binding.installationId,
        repositoryNodeId: binding.repositoryNodeId,
        repositoryOwner: binding.repositoryOwner,
        repositoryName: binding.repositoryName,
        repositoryFullName: binding.repositoryFullName,
        repositoryUrl: binding.repositoryUrl,
        defaultBranch: binding.defaultBranch,
        visibility: binding.visibility,
        updatedAt: binding.updatedAt,
        lastVerifiedAt: binding.lastVerifiedAt,
      },
    })
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    await this.prisma.projectRepositoryBinding.deleteMany({
      where: {
        projectId,
      },
    })
  }
}
