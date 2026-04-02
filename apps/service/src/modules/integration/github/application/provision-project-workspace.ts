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
  const project =
    (await deps.projectRepository.findByIdAndOwnerUserId?.(
      input.projectId,
      input.ownerUserId,
    )) ?? (await deps.projectRepository.findById(input.projectId))

  if (!project || project.ownerUserId !== input.ownerUserId) {
    throw createProjectError().notFound()
  }

  if (project.source.type !== "git") {
    throw createProjectError().invalidState(
      "only git projects can provision a managed workspace",
    )
  }

  if (project.rootPath || project.normalizedPath) {
    requireProjectWorkspace(project)
    throw createProjectError().invalidState("project workspace is already available")
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

  const token = await deps.githubAppClient.createInstallationAccessToken(installation.id)
  const workspacePath = path.join(
    deps.workspaceRootDirectory,
    input.ownerUserId,
    project.id,
  )

  await deps.workspaceManager.cloneRepository({
    repositoryUrl: binding.repositoryUrl,
    branch: project.source.branch ?? binding.defaultBranch,
    targetPath: workspacePath,
    accessToken: token.token,
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
