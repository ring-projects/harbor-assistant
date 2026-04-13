import type { PrismaClient } from "@prisma/client"

import type {
  WorkspaceGitHubInstallationLink,
  WorkspaceInstallationRepository,
} from "../../application/workspace-installation-repository"

function toDomainLink(link: {
  workspaceId: string
  installationId: string
  linkedByUserId: string
  createdAt: Date
  updatedAt: Date
}): WorkspaceGitHubInstallationLink {
  return {
    workspaceId: link.workspaceId,
    installationId: link.installationId,
    linkedByUserId: link.linkedByUserId,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  }
}

export class PrismaWorkspaceInstallationRepository
  implements WorkspaceInstallationRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findLink(
    workspaceId: string,
    installationId: string,
  ): Promise<WorkspaceGitHubInstallationLink | null> {
    const link = await this.prisma.workspaceGitHubInstallation.findUnique({
      where: {
        workspaceId_installationId: {
          workspaceId,
          installationId,
        },
      },
    })

    return link ? toDomainLink(link) : null
  }

  async listLinksByWorkspaceId(
    workspaceId: string,
  ): Promise<WorkspaceGitHubInstallationLink[]> {
    const links = await this.prisma.workspaceGitHubInstallation.findMany({
      where: { workspaceId },
      orderBy: [{ updatedAt: "desc" }],
    })

    return links.map(toDomainLink)
  }

  async saveLink(link: WorkspaceGitHubInstallationLink): Promise<void> {
    await this.prisma.workspaceGitHubInstallation.upsert({
      where: {
        workspaceId_installationId: {
          workspaceId: link.workspaceId,
          installationId: link.installationId,
        },
      },
      create: {
        workspaceId: link.workspaceId,
        installationId: link.installationId,
        linkedByUserId: link.linkedByUserId,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      },
      update: {
        linkedByUserId: link.linkedByUserId,
        updatedAt: link.updatedAt,
      },
    })
  }
}
