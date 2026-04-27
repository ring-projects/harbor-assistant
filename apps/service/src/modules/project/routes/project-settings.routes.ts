import type { FastifyInstance } from "fastify"

import { getProjectUseCase } from "../application/get-project"
import { updateProjectSettingsUseCase } from "../application/update-project-settings"
import { toProjectAppError } from "../project-app-error"
import type { ProjectIdParams, UpdateProjectSettingsBody } from "../schemas"
import {
  getProjectSettingsRouteSchema,
  updateProjectSettingsRouteSchema,
} from "../schemas"
import type { ProjectModuleRouteOptions } from "./shared"
import { getAuthorizationActor, requireRouteAuthorization } from "./shared"

export async function registerProjectSettingsRoutes(
  app: FastifyInstance,
  options: ProjectModuleRouteOptions,
) {
  const { repository } = options

  app.get<{ Params: ProjectIdParams }>(
    "/projects/:id/settings",
    {
      schema: getProjectSettingsRouteSchema,
    },
    async (request) => {
      try {
        const actor = getAuthorizationActor(request)
        await requireRouteAuthorization(
          options.authorization,
          actor,
          "project.settings.read",
          {
            kind: "project",
            projectId: request.params.id,
          },
        )
        const project = await getProjectUseCase(repository, request.params.id)

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
        const actor = getAuthorizationActor(request)
        await requireRouteAuthorization(
          options.authorization,
          actor,
          "project.settings.update",
          {
            kind: "project",
            projectId: request.params.id,
          },
        )
        const project = await updateProjectSettingsUseCase(repository, {
          projectId: request.params.id,
          changes: request.body,
        })

        return {
          ok: true,
          project,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )
}
