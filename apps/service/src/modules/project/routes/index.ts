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

  function toResponseProject(project: Awaited<ReturnType<typeof getProjectUseCase>>) {
    return {
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      archivedAt: project.archivedAt?.toISOString() ?? null,
      lastOpenedAt: project.lastOpenedAt?.toISOString() ?? null,
    }
  }

  app.get(
    "/projects",
    {
      schema: listProjectsRouteSchema,
    },
    async () => {
      const projects = await listProjectsUseCase(repository)
      return {
        ok: true,
        projects: projects.map(toResponseProject),
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
        const project = await createProjectUseCase(
          repository,
          pathPolicy,
          request.body,
        )
        return reply.status(201).send({
          ok: true,
          project: toResponseProject(project),
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
        const { id } = request.params
        const project = await getProjectUseCase(repository, id)
        return {
          ok: true,
          project: toResponseProject(project),
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
        const { id } = request.params
        const project = await updateProjectUseCase(repository, pathPolicy, {
          projectId: id,
          changes: request.body,
        })

        return {
          ok: true,
          project: toResponseProject(project),
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
        const { id } = request.params
        const project = await getProjectUseCase(repository, id)
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
        const { id } = request.params
        const project = await updateProjectSettingsUseCase(repository, {
          projectId: id,
          changes: request.body,
        })
        return {
          ok: true,
          project: toResponseProject(project),
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
        const { id } = request.params
        const project = await archiveProjectUseCase(repository, id)
        return {
          ok: true,
          project: toResponseProject(project),
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
        const { id } = request.params
        const project = await restoreProjectUseCase(repository, id)
        return {
          ok: true,
          project: toResponseProject(project),
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
        const { id } = request.params
        const result = await deleteProjectUseCase(repository, id)
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
