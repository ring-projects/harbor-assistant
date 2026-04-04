import { requireProjectWorkspace } from "../../../project/domain/project"
import type { ProjectRepository } from "../../../project/application/project-repository"
import type { GitHubAppClient } from "./github-app-client"
import type { GitHubInstallationRepository } from "./github-installation-repository"
import type { ProjectRepositoryBindingRepository } from "./project-repository-binding-repository"
import type { ProjectWorkspaceManager } from "./project-workspace-manager"
import { resolveGitHubManagedProjectContext } from "./resolve-github-managed-project-context"

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
  const context = await resolveGitHubManagedProjectContext(deps, input)
  const { project, binding, accessToken } = context
  const workspace = requireProjectWorkspace(project)
  await deps.workspaceManager.syncRepository({
    repositoryUrl: binding.repositoryUrl,
    rootPath: workspace.rootPath,
    accessToken: accessToken.token,
  })

  return {
    projectId: project.id,
    syncedAt: new Date(),
  }
}
