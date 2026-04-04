import path from "node:path"

import {
  attachProjectWorkspace,
  requireProjectWorkspace,
} from "../../../project/domain/project"
import { createProjectError } from "../../../project/errors"
import type { ProjectRepository } from "../../../project/application/project-repository"
import type { GitHubAppClient } from "./github-app-client"
import type { GitHubInstallationRepository } from "./github-installation-repository"
import type { ProjectRepositoryBindingRepository } from "./project-repository-binding-repository"
import type { ProjectWorkspaceManager } from "./project-workspace-manager"
import { resolveGitHubManagedProjectContext } from "./resolve-github-managed-project-context"

export async function provisionProjectWorkspaceUseCase(
  deps: {
    projectRepository: ProjectRepository
    installationRepository: GitHubInstallationRepository
    bindingRepository: ProjectRepositoryBindingRepository
    githubAppClient: GitHubAppClient
    workspaceManager: ProjectWorkspaceManager
    workspaceRootDirectory: string
  },
  input: {
    projectId: string
    ownerUserId: string
  },
) {
  const context = await resolveGitHubManagedProjectContext(deps, input)
  const { project, binding, accessToken } = context

  if (project.rootPath || project.normalizedPath) {
    requireProjectWorkspace(project)
    throw createProjectError().invalidState("project workspace is already available")
  }
  const workspacePath = path.join(
    deps.workspaceRootDirectory,
    input.ownerUserId,
    project.id,
  )

  await deps.workspaceManager.cloneRepository({
    repositoryUrl: binding.repositoryUrl,
    branch: project.source.branch ?? binding.defaultBranch,
    targetPath: workspacePath,
    accessToken: accessToken.token,
  })

  const next = attachProjectWorkspace(
    project,
    {
      rootPath: workspacePath,
      normalizedPath: workspacePath,
    },
  )
  await deps.projectRepository.save(next)
  return next
}
