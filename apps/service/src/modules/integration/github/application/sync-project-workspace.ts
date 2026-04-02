import { requireProjectWorkspace } from "../../../project/domain/project"
import { createProjectError } from "../../../project/errors"
import type { ProjectRepository } from "../../../project/application/project-repository"
import type { GitHubAppClient } from "./github-app-client"
import type { GitHubInstallationRepository } from "./github-installation-repository"
import type { ProjectRepositoryBindingRepository } from "./project-repository-binding-repository"
import type { ProjectWorkspaceManager } from "./project-workspace-manager"

export async function syncProjectWorkspaceUseCase(
  deps: {
    projectRepository: ProjectRepository
    installationRepository: GitHubInstallationRepository
    bindingRepository: ProjectRepositoryBindingRepository
    githubAppClient: GitHubAppClient
    workspaceManager: ProjectWorkspaceManager
  },
  input: {
    projectId: string
    ownerUserId: string
  },
) {
  const project =
    (await deps.projectRepository.findByIdAndOwnerUserId?.(
      input.projectId,
      input.ownerUserId,
    )) ?? (await deps.projectRepository.findById(input.projectId))

  if (!project || project.ownerUserId !== input.ownerUserId) {
    throw createProjectError().notFound()
  }

  if (project.source.type !== "git") {
    throw createProjectError().invalidState("only git projects can sync a managed workspace")
  }

  const workspace = requireProjectWorkspace(project)
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

  const token = await deps.githubAppClient.createInstallationAccessToken(installation.id)
  await deps.workspaceManager.syncRepository({
    repositoryUrl: binding.repositoryUrl,
    rootPath: workspace.rootPath,
    accessToken: token.token,
  })

  return {
    projectId: project.id,
    syncedAt: new Date(),
  }
}
