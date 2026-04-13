import { ERROR_CODES } from "../../../../constants/errors"
import { AppError } from "../../../../lib/errors/app-error"
import type { GitHubAppClient } from "./github-app-client"
import type { GitHubInstallationRepository } from "./github-installation-repository"
import type { ProjectRepositoryBinding } from "./project-repository-binding-repository"
import type { WorkspaceInstallationRepository } from "./workspace-installation-repository"
import { ensureWorkspaceInstallationAccess } from "./ensure-workspace-installation-access"

export async function buildGitHubProjectRepositoryBinding(
  deps: {
    installationRepository: GitHubInstallationRepository
    githubAppClient: GitHubAppClient
  },
  input: {
    projectId: string
    actorUserId: string
    workspaceId: string | null
    installationId: string
    repositoryFullName: string
    workspaceInstallationRepository?: WorkspaceInstallationRepository
    now?: Date
  },
): Promise<ProjectRepositoryBinding> {
  const installation = input.workspaceInstallationRepository
    ? await ensureWorkspaceInstallationAccess(
        {
          installationRepository: deps.installationRepository,
          workspaceInstallationRepository: input.workspaceInstallationRepository,
        },
        {
          workspaceId: input.workspaceId,
          installationId: input.installationId,
          actorUserId: input.actorUserId,
          now: input.now,
        },
      )
    : await deps.installationRepository.findById(input.installationId)

  if (!installation) {
    throw new AppError(
      ERROR_CODES.NOT_FOUND,
      404,
      "GitHub installation not found.",
    )
  }

  const repositories = await deps.githubAppClient.listInstallationRepositories(
    installation.id,
  )
  const selectedRepository = repositories.find(
    (item) =>
      item.fullName.toLowerCase() === input.repositoryFullName.toLowerCase(),
  )

  if (!selectedRepository) {
    throw new AppError(
      ERROR_CODES.NOT_FOUND,
      404,
      "GitHub repository not found in installation scope.",
    )
  }

  const now = input.now ?? new Date()

  return {
    projectId: input.projectId,
    provider: "github",
    installationId: installation.id,
    repositoryNodeId: selectedRepository.nodeId,
    repositoryOwner: selectedRepository.owner,
    repositoryName: selectedRepository.name,
    repositoryFullName: selectedRepository.fullName,
    repositoryUrl: selectedRepository.url,
    defaultBranch: selectedRepository.defaultBranch,
    visibility: selectedRepository.visibility,
    createdAt: now,
    updatedAt: now,
    lastVerifiedAt: now,
  }
}
