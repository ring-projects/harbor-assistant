import { ERROR_CODES } from "../../../constants/errors"
import { AppError } from "../../../lib/errors/app-error"
import type { GitHubAppClient } from "../../integration/github/application/github-app-client"
import type { GitHubInstallationRepository } from "../../integration/github/application/github-installation-repository"
import type {
  ProjectRepositoryBinding,
  ProjectRepositoryBindingRepository,
} from "../../integration/github/application/project-repository-binding-repository"
import type { ProjectWorkspaceManager } from "../../integration/github/application/project-workspace-manager"
import type { ProjectPathPolicy } from "../application/project-path-policy"
import type { ProjectRepository } from "../application/project-repository"
import type { ProjectRepositoryBindingResponse } from "../schemas"

export type ProjectModuleRouteOptions = {
  repository: ProjectRepository
  pathPolicy: ProjectPathPolicy
  installationRepository?: GitHubInstallationRepository
  repositoryBindingRepository?: ProjectRepositoryBindingRepository
  githubAppClient?: GitHubAppClient
  workspaceManager?: ProjectWorkspaceManager
  workspaceRootDirectory?: string
}

export type ProjectGitHubAccess = {
  installationRepository: GitHubInstallationRepository
  repositoryBindingRepository: ProjectRepositoryBindingRepository
  githubAppClient: GitHubAppClient
  workspaceManager?: ProjectWorkspaceManager
  workspaceRootDirectory?: string
}

export function getOwnerUserId(request: { auth: { userId: string } | null }) {
  return request.auth!.userId
}

export function requireGitHubRepositoryAccess(
  options: ProjectModuleRouteOptions,
): ProjectGitHubAccess {
  if (
    !options.installationRepository ||
    !options.repositoryBindingRepository ||
    !options.githubAppClient
  ) {
    throw new AppError(
      ERROR_CODES.AUTH_NOT_CONFIGURED,
      503,
      "GitHub repository access is not configured.",
    )
  }

  return {
    installationRepository: options.installationRepository,
    repositoryBindingRepository: options.repositoryBindingRepository,
    githubAppClient: options.githubAppClient,
    workspaceManager: options.workspaceManager,
    workspaceRootDirectory: options.workspaceRootDirectory,
  }
}

export function toRepositoryBindingResponse(
  binding: ProjectRepositoryBinding,
  hasWorkspace: boolean,
): ProjectRepositoryBindingResponse {
  return {
    projectId: binding.projectId,
    provider: binding.provider,
    installationId: binding.installationId,
    repositoryOwner: binding.repositoryOwner,
    repositoryName: binding.repositoryName,
    repositoryFullName: binding.repositoryFullName,
    repositoryUrl: binding.repositoryUrl,
    defaultBranch: binding.defaultBranch,
    visibility: binding.visibility,
    workspaceState: hasWorkspace ? "ready" : "unprovisioned",
  }
}
