import type { FastifyInstance } from "fastify"

import { createOwnerScopedProjectRepository } from "../../auth"
import { getProjectUseCase } from "../application/get-project"
import { updateProjectSettingsUseCase } from "../application/update-project-settings"
import { toProjectAppError } from "../project-app-error"
import type { ProjectIdParams, UpdateProjectSettingsBody } from "../schemas"
import {
  getProjectSettingsRouteSchema,
  updateProjectSettingsRouteSchema,
} from "../schemas"
import type { ProjectModuleRouteOptions } from "./shared"
import { getOwnerUserId } from "./shared"

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
        const ownerUserId = getOwnerUserId(request)
        const project = await getProjectUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
          request.params.id,
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
        const project = await updateProjectSettingsUseCase(
          createOwnerScopedProjectRepository(repository, ownerUserId),
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
}
