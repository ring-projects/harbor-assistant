import type { ProjectPathPolicy } from "../../../project/application/project-path-policy"
import type { ProjectRepository } from "../../../project/application/project-repository"
import {
  createProjectUseCase,
  type CreateProjectCommand,
} from "../../../project/application/create-project"
import { buildGitHubProjectRepositoryBinding } from "./build-github-project-repository-binding"
import type { GitHubAppClient } from "./github-app-client"
import type { GitHubInstallationRepository } from "./github-installation-repository"
import type { ProjectRepositoryBindingRepository } from "./project-repository-binding-repository"

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
  const now = input.now ?? new Date()
  const binding = await buildGitHubProjectRepositoryBinding(
    {
      installationRepository: deps.installationRepository,
      githubAppClient: deps.githubAppClient,
    },
    {
      projectId: input.id,
      ownerUserId: input.ownerUserId,
      installationId: input.repositoryBinding.installationId,
      repositoryFullName: input.repositoryBinding.repositoryFullName,
      now,
    },
  )

  const project = await createProjectUseCase(
    deps.projectRepository,
    deps.pathPolicy,
    {
      ...input,
      now,
    },
  )

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
