import type { FastifyInstance } from "fastify"

import { AppError } from "../../../lib/errors/app-error"
import { ERROR_CODES } from "../../../constants/errors"
import { archiveProjectUseCase } from "../application/archive-project"
import { createProjectUseCase } from "../application/create-project"
import { deleteProjectUseCase } from "../application/delete-project"
import { getProjectUseCase } from "../application/get-project"
import { listProjectsUseCase } from "../application/list-projects"
import type { ProjectPathPolicy } from "../application/project-path-policy"
import type { ProjectRepository } from "../application/project-repository"
import { restoreProjectUseCase } from "../application/restore-project"
import { updateProjectUseCase } from "../application/update-project"
import { updateProjectSettingsUseCase } from "../application/update-project-settings"
import type { GitHubAppClient } from "../../integration/github/application/github-app-client"
import type { GitHubInstallationRepository } from "../../integration/github/application/github-installation-repository"
import type {
  ProjectRepositoryBinding,
  ProjectRepositoryBindingRepository,
} from "../../integration/github/application/project-repository-binding-repository"
import { provisionProjectWorkspaceUseCase } from "../../integration/github/application/provision-project-workspace"
import type { ProjectWorkspaceManager } from "../../integration/github/application/project-workspace-manager"
import { syncProjectWorkspaceUseCase } from "../../integration/github/application/sync-project-workspace"
import {
  createOwnerScopedProjectRepository,
} from "../../auth"
import { toProjectAppError } from "../project-app-error"
import {
  archiveProjectRouteSchema,
  createProjectRouteSchema,
  deleteProjectRouteSchema,
  getProjectRouteSchema,
  getProjectRepositoryBindingRouteSchema,
  getProjectSettingsRouteSchema,
  listProjectsRouteSchema,
  type CreateProjectBody,
  type ProjectIdParams,
  type ProjectRepositoryBindingResponse,
  provisionProjectWorkspaceRouteSchema,
  restoreProjectRouteSchema,
  syncProjectWorkspaceRouteSchema,
  type UpdateProjectBody,
  type UpdateProjectSettingsBody,
  updateProjectRouteSchema,
  updateProjectSettingsRouteSchema,
} from "../schemas"

export async function registerProjectModuleRoutes(
  app: FastifyInstance,
  options: {
    repository: ProjectRepository
    pathPolicy: ProjectPathPolicy
    installationRepository?: GitHubInstallationRepository
    repositoryBindingRepository?: ProjectRepositoryBindingRepository
    githubAppClient?: GitHubAppClient
    workspaceManager?: ProjectWorkspaceManager
    workspaceRootDirectory?: string
  },
) {
  const { repository, pathPolicy } = options

  function getOwnerUserId(request: { auth: { userId: string } | null }) {
    return request.auth!.userId
  }

  function requireGitHubRepositoryAccess() {
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

  function toRepositoryBindingResponse(
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

  app.get(
    "/projects",
    {
      schema: listProjectsRouteSchema,
    },
    async (request) => {
      const ownerUserId = getOwnerUserId(request)
      const projects = await listProjectsUseCase(
        createOwnerScopedProjectRepository(repository, ownerUserId),
      )
      return {
        ok: true,
        projects,
      }
    },
  )

  app.post<{ Body: CreateProjectBody }>(
    "/projects",
    {
      schema: createProjectRouteSchema,
    },
    async (request, reply) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const repositoryBinding =
          request.body.source.type === "git"
            ? request.body.repositoryBinding
            : undefined
        if (
          request.body.source.type === "rootPath" &&
          "repositoryBinding" in request.body &&
          request.body.repositoryBinding
        ) {
          throw new AppError(
            ERROR_CODES.INVALID_REQUEST_BODY,
            400,
            "repositoryBinding is only supported for git projects.",
          )
        }

        const project = await createProjectUseCase(
          repository,
          pathPolicy,
          {
            ...request.body,
            ownerUserId,
          },
        )

        if (
          request.body.source.type === "git" &&
          repositoryBinding
        ) {
          const githubAccess = requireGitHubRepositoryAccess()
          const installation =
            await githubAccess.installationRepository.findByIdAndInstalledByUserId(
              repositoryBinding.installationId,
              ownerUserId,
            )

          if (!installation) {
            throw new AppError(
              ERROR_CODES.NOT_FOUND,
              404,
              "GitHub installation not found.",
            )
          }

          const repositories =
            await githubAccess.githubAppClient.listInstallationRepositories(
              installation.id,
            )
          const selectedRepository = repositories.find(
            (item) =>
              item.fullName.toLowerCase() ===
              repositoryBinding.repositoryFullName.toLowerCase(),
          )

          if (!selectedRepository) {
            throw new AppError(
              ERROR_CODES.NOT_FOUND,
              404,
              "GitHub repository not found in installation scope.",
            )
          }

          await githubAccess.repositoryBindingRepository.save({
            projectId: project.id,
            provider: "github",
            installationId: installation.id,
            repositoryNodeId: selectedRepository.nodeId,
            repositoryOwner: selectedRepository.owner,
            repositoryName: selectedRepository.name,
            repositoryFullName: selectedRepository.fullName,
            repositoryUrl: selectedRepository.url,
            defaultBranch: selectedRepository.defaultBranch,
            visibility: selectedRepository.visibility,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastVerifiedAt: new Date(),
          })
        }

        return reply.status(201).send({
          ok: true,
          project,
        })
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.get<{ Params: ProjectIdParams }>(
    "/projects/:id",
    {
      schema: getProjectRouteSchema,
    },
    async (request) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const { id } = request.params
        const project = await getProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          id,
        )
        return {
          ok: true,
          project,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.patch<{ Params: ProjectIdParams; Body: UpdateProjectBody }>(
    "/projects/:id",
    {
      schema: updateProjectRouteSchema,
    },
    async (request) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const { id } = request.params
        const project = await updateProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          pathPolicy,
          {
            projectId: id,
            changes: request.body,
          },
        )

        return {
          ok: true,
          project,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.get<{ Params: ProjectIdParams }>(
    "/projects/:id/repository-binding",
    {
      schema: getProjectRepositoryBindingRouteSchema,
    },
    async (request) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const githubAccess = requireGitHubRepositoryAccess()
        const project = await getProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          request.params.id,
        )
        const binding =
          await githubAccess.repositoryBindingRepository.findByProjectId(project.id)

        if (!binding) {
          throw new AppError(
            ERROR_CODES.NOT_FOUND,
            404,
            "Project repository binding not found.",
          )
        }

        return {
          ok: true,
          repositoryBinding: toRepositoryBindingResponse(
            binding,
            Boolean(project.rootPath && project.normalizedPath),
          ),
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.post<{ Params: ProjectIdParams }>(
    "/projects/:id/provision-workspace",
    {
      schema: provisionProjectWorkspaceRouteSchema,
    },
    async (request) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const githubAccess = requireGitHubRepositoryAccess()
        if (!githubAccess.workspaceManager || !githubAccess.workspaceRootDirectory) {
          throw new AppError(
            ERROR_CODES.AUTH_NOT_CONFIGURED,
            503,
            "GitHub workspace provisioning is not configured.",
          )
        }

        const project = await provisionProjectWorkspaceUseCase(
          {
            projectRepository: repository,
            installationRepository: githubAccess.installationRepository,
            bindingRepository: githubAccess.repositoryBindingRepository,
            githubAppClient: githubAccess.githubAppClient,
            workspaceManager: githubAccess.workspaceManager,
            workspaceRootDirectory: githubAccess.workspaceRootDirectory,
          },
          {
            projectId: request.params.id,
            ownerUserId,
          },
        )
        const binding =
          await githubAccess.repositoryBindingRepository.findByProjectId(project.id)

        if (!binding) {
          throw new AppError(
            ERROR_CODES.NOT_FOUND,
            404,
            "Project repository binding not found.",
          )
        }

        return {
          ok: true,
          project,
          repositoryBinding: toRepositoryBindingResponse(binding, true),
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.post<{ Params: ProjectIdParams }>(
    "/projects/:id/sync",
    {
      schema: syncProjectWorkspaceRouteSchema,
    },
    async (request) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const githubAccess = requireGitHubRepositoryAccess()
        if (!githubAccess.workspaceManager) {
          throw new AppError(
            ERROR_CODES.AUTH_NOT_CONFIGURED,
            503,
            "GitHub workspace sync is not configured.",
          )
        }

        const result = await syncProjectWorkspaceUseCase(
          {
            projectRepository: repository,
            installationRepository: githubAccess.installationRepository,
            bindingRepository: githubAccess.repositoryBindingRepository,
            githubAppClient: githubAccess.githubAppClient,
            workspaceManager: githubAccess.workspaceManager,
          },
          {
            projectId: request.params.id,
            ownerUserId,
          },
        )

        return {
          ok: true,
          projectId: result.projectId,
          syncedAt: result.syncedAt.toISOString(),
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.get<{ Params: ProjectIdParams }>(
    "/projects/:id/settings",
    {
      schema: getProjectSettingsRouteSchema,
    },
    async (request) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const { id } = request.params
        const project = await getProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          id,
        )
        return {
          ok: true,
          settings: project.settings,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.patch<{ Params: ProjectIdParams; Body: UpdateProjectSettingsBody }>(
    "/projects/:id/settings",
    {
      schema: updateProjectSettingsRouteSchema,
    },
    async (request) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const { id } = request.params
        const project = await updateProjectSettingsUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          {
            projectId: id,
            changes: request.body,
          },
        )
        return {
          ok: true,
          project,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.post<{ Params: ProjectIdParams }>(
    "/projects/:id/archive",
    {
      schema: archiveProjectRouteSchema,
    },
    async (request) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const { id } = request.params
        const project = await archiveProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          id,
        )
        return {
          ok: true,
          project,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.post<{ Params: ProjectIdParams }>(
    "/projects/:id/restore",
    {
      schema: restoreProjectRouteSchema,
    },
    async (request) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const { id } = request.params
        const project = await restoreProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          id,
        )
        return {
          ok: true,
          project,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.delete<{ Params: ProjectIdParams }>(
    "/projects/:id",
    {
      schema: deleteProjectRouteSchema,
    },
    async (request) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const { id } = request.params
        const result = await deleteProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          id,
        )
        return {
          ok: true,
          ...result,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )
}
