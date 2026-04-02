import type { PrismaClient } from "@prisma/client"

import type {
  GitHubAppInstallation,
  GitHubInstallationRepository,
} from "../../application/github-installation-repository"
import { toDomainGitHubAppInstallation } from "./github-installation-mapper"

export class PrismaGitHubInstallationRepository
  implements GitHubInstallationRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<GitHubAppInstallation | null> {
    const installation = await this.prisma.gitHubAppInstallation.findUnique({
      where: { id },
    })

    return installation ? toDomainGitHubAppInstallation(installation) : null
  }

  async findByIdAndInstalledByUserId(
    id: string,
    installedByUserId: string,
  ): Promise<GitHubAppInstallation | null> {
    const installation = await this.prisma.gitHubAppInstallation.findFirst({
      where: {
        id,
        installedByUserId,
      },
    })

    return installation ? toDomainGitHubAppInstallation(installation) : null
  }

  async listByInstalledByUserId(
    installedByUserId: string,
  ): Promise<GitHubAppInstallation[]> {
    const installations = await this.prisma.gitHubAppInstallation.findMany({
      where: {
        installedByUserId,
      },
      orderBy: [{ updatedAt: "desc" }],
    })

    return installations.map(toDomainGitHubAppInstallation)
  }

  async save(installation: GitHubAppInstallation): Promise<void> {
    await this.prisma.gitHubAppInstallation.upsert({
      where: { id: installation.id },
      create: {
        id: installation.id,
        accountType: installation.accountType,
        accountLogin: installation.accountLogin,
        targetType: installation.targetType,
        status: installation.status,
        installedByUserId: installation.installedByUserId,
        createdAt: installation.createdAt,
        updatedAt: installation.updatedAt,
        lastValidatedAt: installation.lastValidatedAt,
      },
      update: {
        accountType: installation.accountType,
        accountLogin: installation.accountLogin,
        targetType: installation.targetType,
        status: installation.status,
        installedByUserId: installation.installedByUserId,
        updatedAt: installation.updatedAt,
        lastValidatedAt: installation.lastValidatedAt,
      },
    })
  }
}
