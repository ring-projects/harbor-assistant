import { createProjectError } from "../../../project/errors"
import type { Project } from "../../../project/domain/project"
import type { ProjectRepository } from "../../../project/application/project-repository"
import type { GitHubAppClient } from "./github-app-client"
import type { GitHubAppInstallation } from "./github-installation-repository"
import type { GitHubInstallationRepository } from "./github-installation-repository"
import type {
  ProjectRepositoryBinding,
  ProjectRepositoryBindingRepository,
} from "./project-repository-binding-repository"

async function findOwnedProject(
  repository: Pick<ProjectRepository, "findById"> & {
    findByIdAndOwnerUserId?: ProjectRepository["findByIdAndOwnerUserId"]
  },
  projectId: string,
  ownerUserId: string,
): Promise<Project | null> {
  const project = repository.findByIdAndOwnerUserId
    ? await repository.findByIdAndOwnerUserId(projectId, ownerUserId)
    : await repository.findById(projectId)

  if (!project || project.ownerUserId !== ownerUserId) {
    return null
  }

  return project
}

export async function resolveGitHubManagedProjectContext(
  deps: {
    projectRepository: ProjectRepository
    installationRepository: GitHubInstallationRepository
    bindingRepository: ProjectRepositoryBindingRepository
    githubAppClient: GitHubAppClient
  },
  input: {
    projectId: string
    ownerUserId: string
  },
): Promise<{
  project: Project & {
    source: Extract<Project["source"], { type: "git" }>
  }
  binding: ProjectRepositoryBinding
  installation: GitHubAppInstallation
  accessToken: Awaited<
    ReturnType<GitHubAppClient["createInstallationAccessToken"]>
  >
}> {
  const project = await findOwnedProject(
    deps.projectRepository,
    input.projectId,
    input.ownerUserId,
  )

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
    throw createProjectError().invalidState("project repository binding is not available")
  }

  const installation =
    await deps.installationRepository.findByIdAndInstalledByUserId(
      binding.installationId,
      input.ownerUserId,
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
    installation,
    accessToken,
  }
}
