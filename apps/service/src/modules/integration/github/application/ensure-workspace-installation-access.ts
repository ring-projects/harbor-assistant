import { ERROR_CODES } from "../../../../constants/errors"
import { AppError } from "../../../../lib/errors/app-error"
import type { GitHubInstallationRepository } from "./github-installation-repository"
import type { WorkspaceInstallationRepository } from "./workspace-installation-repository"

export async function ensureWorkspaceInstallationAccess(
  deps: {
    installationRepository: GitHubInstallationRepository
    workspaceInstallationRepository: WorkspaceInstallationRepository
  },
  input: {
    workspaceId: string | null
    installationId: string
    actorUserId: string
    now?: Date
  },
) {
  if (!input.workspaceId) {
    const installation =
      await deps.installationRepository.findByIdAndInstalledByUserId(
        input.installationId,
        input.actorUserId,
      )

    if (!installation) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        404,
        "GitHub installation not found.",
      )
    }

    return installation
  }

  const existingLink = await deps.workspaceInstallationRepository.findLink(
    input.workspaceId,
    input.installationId,
  )
  if (existingLink) {
    const installation = await deps.installationRepository.findById(
      input.installationId,
    )
    if (!installation) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        404,
        "GitHub installation not found.",
      )
    }

    return installation
  }

  const installation =
    await deps.installationRepository.findByIdAndInstalledByUserId(
      input.installationId,
      input.actorUserId,
    )
  if (!installation) {
    throw new AppError(
      ERROR_CODES.NOT_FOUND,
      404,
      "GitHub installation not found.",
    )
  }

  const now = input.now ?? new Date()
  await deps.workspaceInstallationRepository.saveLink({
    workspaceId: input.workspaceId,
    installationId: input.installationId,
    linkedByUserId: input.actorUserId,
    createdAt: now,
    updatedAt: now,
  })

  return installation
}
