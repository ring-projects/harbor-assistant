import type { FastifyInstance } from "fastify"

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
import {
  createOwnerScopedProjectRepository,
} from "../../auth"
import { toProjectAppError } from "../project-app-error"
import {
  archiveProjectRouteSchema,
  createProjectRouteSchema,
  deleteProjectRouteSchema,
  getProjectRouteSchema,
  getProjectSettingsRouteSchema,
  listProjectsRouteSchema,
  type CreateProjectBody,
  type ProjectIdParams,
  restoreProjectRouteSchema,
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
  },
) {
  const { repository, pathPolicy } = options

  function getOwnerUserId(request: { auth: { userId: string } | null }) {
    return request.auth!.userId
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
        const project = await createProjectUseCase(
          repository,
          pathPolicy,
          {
            ...request.body,
            ownerUserId,
          },
        )
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
