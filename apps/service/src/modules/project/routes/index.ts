import type { FastifyInstance } from "fastify"

import { registerProjectCoreRoutes } from "./project-core.routes"
import { registerProjectGitHubRoutes } from "./project-github.routes"
import { registerProjectSettingsRoutes } from "./project-settings.routes"
import type { ProjectModuleRouteOptions } from "./shared"

export async function registerProjectModuleRoutes(
  app: FastifyInstance,
  options: ProjectModuleRouteOptions,
) {
  await registerProjectCoreRoutes(app, options)
  await registerProjectGitHubRoutes(app, options)
  await registerProjectSettingsRoutes(app, options)
}
