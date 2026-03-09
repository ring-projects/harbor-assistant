import type { FastifyInstance } from "fastify"

import type { ProjectService } from "../services"
import {
  createProjectRouteSchema,
  deleteProjectRouteSchema,
  listProjectsRouteSchema,
  type CreateProjectBody,
  type ProjectIdParams,
  type UpdateProjectBody,
  updateProjectRouteSchema,
} from "../schemas"

export async function registerProjectRoutes(
  app: FastifyInstance,
  args: { projectService: ProjectService },
) {
  const { projectService } = args

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
}
