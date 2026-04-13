import type {
  GitHubAppInstallation,
  GitHubInstallationRepository,
} from "../application/github-installation-repository"
import { ERROR_CODES } from "../../../../constants/errors"
import { AppError } from "../../../../lib/errors/app-error"

export class InMemoryGitHubInstallationRepository
  implements GitHubInstallationRepository
{
  private readonly installations = new Map<string, GitHubAppInstallation>()

  async findById(id: string): Promise<GitHubAppInstallation | null> {
    return this.installations.get(id) ?? null
  }

  async findByIdAndInstalledByUserId(
    id: string,
    installedByUserId: string,
  ): Promise<GitHubAppInstallation | null> {
    const installation = this.installations.get(id) ?? null
    if (!installation || installation.installedByUserId !== installedByUserId) {
      return null
    }

    return installation
  }

  async listByInstalledByUserId(
    installedByUserId: string,
  ): Promise<GitHubAppInstallation[]> {
    return Array.from(this.installations.values()).filter(
      (installation) => installation.installedByUserId === installedByUserId,
    )
  }

  async save(installation: GitHubAppInstallation): Promise<void> {
    const existing = this.installations.get(installation.id)

    if (
      existing?.installedByUserId &&
      installation.installedByUserId &&
      existing.installedByUserId !== installation.installedByUserId
    ) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        409,
        "GitHub installation is already linked to another Harbor user.",
      )
    }

    this.installations.set(installation.id, installation)
  }
}
