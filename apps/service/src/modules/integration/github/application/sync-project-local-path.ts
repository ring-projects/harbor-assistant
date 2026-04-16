import { requireProjectLocalPath } from "../../../project/domain/project"
import type { ProjectRepository } from "../../../project/application/project-repository"
import type { GitHubAppClient } from "./github-app-client"
import type { GitHubInstallationRepository } from "./github-installation-repository"
import type { ProjectRepositoryBindingRepository } from "./project-repository-binding-repository"
import type { ProjectLocalPathManager } from "./project-local-path-manager"
import { resolveGitHubManagedProjectContext } from "./resolve-github-managed-project-context"

export async function syncProjectLocalPathUseCase(
  deps: {
    projectRepository: ProjectRepository
    installationRepository: GitHubInstallationRepository
    bindingRepository: ProjectRepositoryBindingRepository
    githubAppClient: GitHubAppClient
    localPathManager: ProjectLocalPathManager
  },
  input: {
    projectId: string
    actorUserId: string
  },
) {
  const context = await resolveGitHubManagedProjectContext(deps, input)
  const { project, binding, accessToken } = context
  const localPath = requireProjectLocalPath(project)
  await deps.localPathManager.syncRepository({
    repositoryUrl: binding.repositoryUrl,
    rootPath: localPath.rootPath,
    accessToken: accessToken.token,
  })

  return {
    projectId: project.id,
    syncedAt: new Date(),
  }
}
