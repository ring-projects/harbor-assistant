import type { GitHubAppInstallation as PrismaGitHubAppInstallation } from "@prisma/client"

import type { GitHubAppInstallation } from "../../application/github-installation-repository"

export function toDomainGitHubAppInstallation(
  installation: PrismaGitHubAppInstallation,
): GitHubAppInstallation {
  return {
    id: installation.id,
    accountType: installation.accountType,
    accountLogin: installation.accountLogin,
    targetType: installation.targetType,
    status: installation.status,
    installedByUserId: installation.installedByUserId,
    createdAt: installation.createdAt,
    updatedAt: installation.updatedAt,
    lastValidatedAt: installation.lastValidatedAt,
  }
}
