import { ERROR_CODES } from "../../../../constants/errors"
import { AppError } from "../../../../lib/errors/app-error"
import type { ProjectPathPolicy } from "../../../project/application/project-path-policy"
import type { ProjectRepository } from "../../../project/application/project-repository"
import {
  createProjectUseCase,
  type CreateProjectCommand,
} from "../../../project/application/create-project"
import type { GitHubAppClient } from "./github-app-client"
import type { GitHubInstallationRepository } from "./github-installation-repository"
import type {
  ProjectRepositoryBinding,
  ProjectRepositoryBindingRepository,
} from "./project-repository-binding-repository"

type CreateGitHubBoundProjectCommand = CreateProjectCommand & {
  ownerUserId: string
  source: {
    type: "git"
    repositoryUrl: string
    branch?: string | null
  }
  repositoryBinding: {
    installationId: string
    repositoryFullName: string
  }
}

export async function createGitHubBoundProjectUseCase(
  deps: {
    projectRepository: ProjectRepository
    pathPolicy: ProjectPathPolicy
    installationRepository: GitHubInstallationRepository
    bindingRepository: ProjectRepositoryBindingRepository
    githubAppClient: GitHubAppClient
  },
  input: CreateGitHubBoundProjectCommand,
) {
  const installation =
    await deps.installationRepository.findByIdAndInstalledByUserId(
      input.repositoryBinding.installationId,
      input.ownerUserId,
    )

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
      item.fullName.toLowerCase() ===
      input.repositoryBinding.repositoryFullName.toLowerCase(),
  )

  if (!selectedRepository) {
    throw new AppError(
      ERROR_CODES.NOT_FOUND,
      404,
      "GitHub repository not found in installation scope.",
    )
  }

  const now = input.now ?? new Date()
  const project = await createProjectUseCase(deps.projectRepository, deps.pathPolicy, {
    ...input,
    now,
  })

  const binding: ProjectRepositoryBinding = {
    projectId: project.id,
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

  try {
    await deps.bindingRepository.save(binding)
  } catch (error) {
    await deps.projectRepository.delete(project.id)
    throw error
  }

  return {
    project,
    binding,
  }
}
