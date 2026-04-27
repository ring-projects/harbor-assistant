import path from "node:path"

import {
  attachProjectLocalPath,
  requireProjectLocalPath,
} from "../../../project/domain/project"
import { createProjectError } from "../../../project/errors"
import type { ProjectRepository } from "../../../project/application/project-repository"
import type { GitHubAppClient } from "./github-app-client"
import type { GitHubInstallationRepository } from "./github-installation-repository"
import type { ProjectRepositoryBindingRepository } from "./project-repository-binding-repository"
import type { ProjectLocalPathManager } from "./project-local-path-manager"
import { resolveGitHubManagedProjectContext } from "./resolve-github-managed-project-context"

export async function provisionProjectLocalPathUseCase(
  deps: {
    projectRepository: ProjectRepository
    installationRepository: GitHubInstallationRepository
    bindingRepository: ProjectRepositoryBindingRepository
    githubAppClient: GitHubAppClient
    localPathManager: ProjectLocalPathManager
    projectLocalPathRootDirectory: string
  },
  input: {
    projectId: string
    actorUserId: string
  },
) {
  const context = await resolveGitHubManagedProjectContext(deps, input)
  const { project, binding, accessToken } = context

  if (project.rootPath || project.normalizedPath) {
    requireProjectLocalPath(project)
    throw createProjectError().invalidState(
      "project local path is already available",
    )
  }
  const localPath = path.join(
    deps.projectLocalPathRootDirectory,
    project.workspaceId ?? project.ownerUserId ?? input.actorUserId,
    project.id,
  )

  await deps.localPathManager.cloneRepository({
    repositoryUrl: binding.repositoryUrl,
    branch: project.source.branch ?? binding.defaultBranch,
    targetPath: localPath,
    accessToken: accessToken.token,
  })

  const next = attachProjectLocalPath(project, {
    rootPath: localPath,
    normalizedPath: localPath,
  })
  await deps.projectRepository.save(next)
  return next
}
