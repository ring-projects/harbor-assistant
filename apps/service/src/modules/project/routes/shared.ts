import { ERROR_CODES } from "../../../constants/errors"
import { AppError } from "../../../lib/errors/app-error"
import {
  type AuthenticatedRequestContext,
  getAuthenticatedActor,
  requireUserAuthenticatedRequest,
} from "../../auth"
import type {
  AuthorizationAction,
  AuthorizationActor,
  AuthorizationResource,
  AuthorizationService,
} from "../../authorization"
import type { GitHubAppClient } from "../../integration/github/application/github-app-client"
import type { GitHubInstallationRepository } from "../../integration/github/application/github-installation-repository"
import type {
  ProjectRepositoryBinding,
  ProjectRepositoryBindingRepository,
} from "../../integration/github/application/project-repository-binding-repository"
import type { WorkspaceInstallationRepository } from "../../integration/github/application/workspace-installation-repository"
import type { ProjectLocalPathManager } from "../../integration/github/application/project-local-path-manager"
import type { WorkspaceRepository } from "../../workspace"
import type { ProjectPathPolicy } from "../application/project-path-policy"
import type { ProjectRepository } from "../application/project-repository"
import type { ProjectRepositoryBindingResponse } from "../schemas"

export type ProjectModuleRouteOptions = {
  authorization: AuthorizationService
  repository: ProjectRepository
  workspaceRepository: WorkspaceRepository
  onProjectCreated?: (
    project: import("../domain/project").Project,
  ) => void | Promise<void>
  workspaceInstallationRepository?: WorkspaceInstallationRepository
  pathPolicy: ProjectPathPolicy
  installationRepository?: GitHubInstallationRepository
  repositoryBindingRepository?: ProjectRepositoryBindingRepository
  githubAppClient?: GitHubAppClient
  localPathManager?: ProjectLocalPathManager
  projectLocalPathRootDirectory?: string
}

export type ProjectGitHubAccess = {
  installationRepository: GitHubInstallationRepository
  repositoryBindingRepository: ProjectRepositoryBindingRepository
  githubAppClient: GitHubAppClient
  localPathManager?: ProjectLocalPathManager
  projectLocalPathRootDirectory?: string
}

export function getOwnerUserId(request: {
  auth: AuthenticatedRequestContext | null
}) {
  return requireUserAuthenticatedRequest(request).userId
}

export function getAuthorizationActor(request: {
  auth: AuthenticatedRequestContext | null
}): AuthorizationActor {
  return getAuthenticatedActor(request)
}

export async function requireRouteAuthorization(
  authorization: AuthorizationService,
  actor: AuthorizationActor,
  action: AuthorizationAction,
  resource: AuthorizationResource,
) {
  await authorization.requireAuthorized({
    actor,
    action,
    resource,
  })
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
    localPathManager: options.localPathManager,
    projectLocalPathRootDirectory: options.projectLocalPathRootDirectory,
  }
}

export function toRepositoryBindingResponse(
  binding: ProjectRepositoryBinding,
  hasLocalPath: boolean,
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
    localPathState: hasLocalPath ? "ready" : "missing",
  }
}
