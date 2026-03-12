import type { FastifyInstance } from "fastify"

import type { ProjectService, ProjectSettingsService } from "../services"
import {
  createProjectRouteSchema,
  deleteProjectRouteSchema,
  getProjectSettingsRouteSchema,
  listProjectsRouteSchema,
  type CreateProjectBody,
  type ProjectIdParams,
  type ProjectSettingsBody,
  type UpdateProjectBody,
  updateProjectSettingsRouteSchema,
  updateProjectRouteSchema,
} from "../schemas"

export async function registerProjectRoutes(
  app: FastifyInstance,
  args: {
    projectService: ProjectService
    projectSettingsService: ProjectSettingsService
  },
) {
  const { projectService, projectSettingsService } = args

  app.get(
    "/projects",
    {
      schema: listProjectsRouteSchema,
    },
    async () => {
      const projects = await projectService.listProjects()
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
    async (request) => {
      const input = request.body
      await projectService.createProject(input)
      const projects = await projectService.listProjects()

      return {
        ok: true,
        projects,
      }
    },
  )

  app.put<{ Params: ProjectIdParams; Body: UpdateProjectBody }>(
    "/projects/:id",
    {
      schema: updateProjectRouteSchema,
    },
    async (request) => {
      const params = request.params
      const input = request.body
      await projectService.updateProject({
        id: params.id,
        ...input,
      })

      const projects = await projectService.listProjects()
      return {
        ok: true,
        projects,
      }
    },
  )

  app.delete<{ Params: ProjectIdParams }>(
    "/projects/:id",
    {
      schema: deleteProjectRouteSchema,
    },
    async (request) => {
      const params = request.params
      await projectService.removeProject(params.id)

      const projects = await projectService.listProjects()
      return {
        ok: true,
        projects,
      }
    },
  )

  app.get<{ Params: ProjectIdParams }>(
    "/projects/:id/settings",
    {
      schema: getProjectSettingsRouteSchema,
    },
    async (request) => {
      const { id } = request.params
      await projectService.getProject(id)
      const settings = await projectSettingsService.getSettings(id)

      return {
        ok: true,
        settings,
      }
    },
  )

  app.put<{ Params: ProjectIdParams; Body: ProjectSettingsBody }>(
    "/projects/:id/settings",
    {
      schema: updateProjectSettingsRouteSchema,
    },
    async (request) => {
      const { id } = request.params
      await projectService.getProject(id)
      const settings = await projectSettingsService.updateSettings({
        projectId: id,
        defaultExecutor: request.body.defaultExecutor,
        defaultModel: request.body.defaultModel,
        defaultExecutionMode: request.body.defaultExecutionMode,
        maxConcurrentTasks: request.body.maxConcurrentTasks,
        logRetentionDays: request.body.logRetentionDays,
        eventRetentionDays: request.body.eventRetentionDays,
      })

      return {
        ok: true,
        settings,
      }
    },
  )
}
