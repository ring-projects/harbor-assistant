import type { FastifyInstance } from "fastify"

import { ERROR_CODES } from "../../../constants/errors"
import { AppError } from "../../../lib/errors/app-error"
import { createOwnerScopedProjectRepository } from "../../auth"
import { buildGitHubProjectRepositoryBinding } from "../../integration/github/application/build-github-project-repository-binding"
import { provisionProjectWorkspaceUseCase } from "../../integration/github/application/provision-project-workspace"
import { syncProjectWorkspaceUseCase } from "../../integration/github/application/sync-project-workspace"
import { getProjectUseCase } from "../application/get-project"
import { createProjectError } from "../errors"
import { toProjectAppError } from "../project-app-error"
import type {
  ProjectIdParams,
  PutProjectRepositoryBindingBody,
} from "../schemas"
import {
  getProjectRepositoryBindingRouteSchema,
  putProjectRepositoryBindingRouteSchema,
  provisionProjectWorkspaceRouteSchema,
  syncProjectWorkspaceRouteSchema,
} from "../schemas"
import type { ProjectModuleRouteOptions } from "./shared"
import {
  getOwnerUserId,
  requireGitHubRepositoryAccess,
  toRepositoryBindingResponse,
} from "./shared"

export async function registerProjectGitHubRoutes(
  app: FastifyInstance,
  options: ProjectModuleRouteOptions,
) {
  const { repository } = options

  app.get<{ Params: ProjectIdParams }>(
    "/projects/:id/repository-binding",
    {
      schema: getProjectRepositoryBindingRouteSchema,
    },
    async (request) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const githubAccess = requireGitHubRepositoryAccess(options)
        const project = await getProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          request.params.id,
        )
        const binding =
          await githubAccess.repositoryBindingRepository.findByProjectId(
            project.id,
          )

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

  app.put<{ Params: ProjectIdParams; Body: PutProjectRepositoryBindingBody }>(
    "/projects/:id/repository-binding",
    {
      schema: putProjectRepositoryBindingRouteSchema,
    },
    async (request) => {
      try {
        const ownerUserId = getOwnerUserId(request)
        const githubAccess = requireGitHubRepositoryAccess(options)
        const ownerScopedRepository = createOwnerScopedProjectRepository(
          repository,
          ownerUserId,
        )
        const project = await getProjectUseCase(
          ownerScopedRepository,
          request.params.id,
        )

        if (project.source.type !== "git") {
          throw createProjectError().invalidState(
            "project repository binding is only supported for git projects",
          )
        }

        const existingBinding =
          await githubAccess.repositoryBindingRepository.findByProjectId(
            project.id,
          )

        if (existingBinding) {
          const isSameBinding =
            existingBinding.installationId === request.body.installationId &&
            existingBinding.repositoryFullName.toLowerCase() ===
              request.body.repositoryFullName.toLowerCase()

          if (!isSameBinding) {
            throw createProjectError().invalidState(
              "project repository binding already exists",
            )
          }

          return {
            ok: true,
            repositoryBinding: toRepositoryBindingResponse(
              existingBinding,
              Boolean(project.rootPath && project.normalizedPath),
            ),
          }
        }

        const binding = await buildGitHubProjectRepositoryBinding(
          {
            installationRepository: githubAccess.installationRepository,
            githubAppClient: githubAccess.githubAppClient,
          },
          {
            projectId: project.id,
            ownerUserId,
            installationId: request.body.installationId,
            repositoryFullName: request.body.repositoryFullName,
          },
        )

        await githubAccess.repositoryBindingRepository.save(binding)

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
        const githubAccess = requireGitHubRepositoryAccess(options)

        if (
          !githubAccess.workspaceManager ||
          !githubAccess.workspaceRootDirectory
        ) {
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
          await githubAccess.repositoryBindingRepository.findByProjectId(
            project.id,
          )

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
        const githubAccess = requireGitHubRepositoryAccess(options)

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
}
