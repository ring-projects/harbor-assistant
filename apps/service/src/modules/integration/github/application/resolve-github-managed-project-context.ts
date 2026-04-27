import { createProjectError } from "../../../project/errors"
import type { Project } from "../../../project/domain/project"
import type { ProjectRepository } from "../../../project/application/project-repository"
import type { GitHubAppClient } from "./github-app-client"
import type { GitHubInstallationRepository } from "./github-installation-repository"
import type {
  ProjectRepositoryBinding,
  ProjectRepositoryBindingRepository,
} from "./project-repository-binding-repository"

export async function resolveGitHubManagedProjectContext(
  deps: {
    projectRepository: ProjectRepository
    installationRepository: GitHubInstallationRepository
    bindingRepository: ProjectRepositoryBindingRepository
    githubAppClient: GitHubAppClient
  },
  input: {
    projectId: string
    actorUserId: string
  },
): Promise<{
  project: Project & {
    source: Extract<Project["source"], { type: "git" }>
  }
  binding: ProjectRepositoryBinding
  accessToken: Awaited<
    ReturnType<GitHubAppClient["createInstallationAccessToken"]>
  >
}> {
  const project = await deps.projectRepository.findById(input.projectId)

  if (!project) {
    throw createProjectError().notFound()
  }

  if (project.source.type !== "git") {
    throw createProjectError().invalidState(
      "only git projects can use managed GitHub workspaces",
    )
  }

  const binding = await deps.bindingRepository.findByProjectId(project.id)
  if (!binding) {
    throw createProjectError().invalidState(
      "project repository binding is not available",
    )
  }

  const installation = await deps.installationRepository.findById(
    binding.installationId,
  )
  if (!installation) {
    throw createProjectError().notFound()
  }

  const accessToken = await deps.githubAppClient.createInstallationAccessToken(
    installation.id,
  )

  return {
    project: project as Project & {
      source: Extract<Project["source"], { type: "git" }>
    },
    binding,
    accessToken,
  }
}
