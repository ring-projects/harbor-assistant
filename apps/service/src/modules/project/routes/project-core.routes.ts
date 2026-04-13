import type { FastifyInstance } from "fastify"

import { AppError } from "../../../lib/errors/app-error"
import { ERROR_CODES } from "../../../constants/errors"
import { createOwnerScopedProjectRepository } from "../../auth"
import { createGitHubBoundProjectUseCase } from "../../integration/github/application/create-github-bound-project"
import { archiveProjectUseCase } from "../application/archive-project"
import { createProjectUseCase } from "../application/create-project"
import { deleteProjectUseCase } from "../application/delete-project"
import { getProjectUseCase } from "../application/get-project"
import { listProjectsUseCase } from "../application/list-projects"
import { restoreProjectUseCase } from "../application/restore-project"
import { updateProjectUseCase } from "../application/update-project"
import { toProjectAppError } from "../project-app-error"
import type {
  CreateProjectBody,
  ProjectIdParams,
  UpdateProjectBody,
} from "../schemas"
import {
  archiveProjectRouteSchema,
  createProjectRouteSchema,
  deleteProjectRouteSchema,
  getProjectRouteSchema,
  listProjectsRouteSchema,
  restoreProjectRouteSchema,
  updateProjectRouteSchema,
} from "../schemas"
import type { ProjectModuleRouteOptions } from "./shared"
import {
  getOwnerUserId,
  requireGitHubRepositoryAccess,
} from "./shared"

export async function registerProjectCoreRoutes(
  app: FastifyInstance,
  options: ProjectModuleRouteOptions,
) {
  const { repository, pathPolicy } = options

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
        const githubAccess =
          request.body.source.type === "git" && request.body.repositoryBinding
            ? requireGitHubRepositoryAccess(options)
            : null

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

        let project

        if (request.body.source.type === "git" && request.body.repositoryBinding) {
          project = (
            await createGitHubBoundProjectUseCase(
              {
                projectRepository: repository,
                pathPolicy,
                installationRepository: githubAccess!.installationRepository,
                bindingRepository: githubAccess!.repositoryBindingRepository,
                githubAppClient: githubAccess!.githubAppClient,
              },
              {
                id: request.body.id,
                name: request.body.name,
                description: request.body.description,
                ownerUserId,
                source: request.body.source,
                repositoryBinding: {
                  installationId: request.body.repositoryBinding.installationId,
                  repositoryFullName:
                    request.body.repositoryBinding.repositoryFullName,
                },
              },
            )
          ).project
        } else {
          project = await createProjectUseCase(repository, pathPolicy, {
            id: request.body.id,
            name: request.body.name,
            description: request.body.description,
            ownerUserId,
            source: request.body.source,
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
        const project = await getProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          request.params.id,
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
        const project = await updateProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          pathPolicy,
          {
            projectId: request.params.id,
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
        const project = await archiveProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          request.params.id,
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
        const project = await restoreProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          request.params.id,
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
        const result = await deleteProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          request.params.id,
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
