import type { FastifyInstance } from "fastify"

import {
  createProjectRepository,
  createProjectSettingsRepository,
} from "../repositories"
import {
  createProjectService,
  createProjectSettingsService,
} from "../services"
import { registerProjectRoutes } from "./project.routes"

export async function registerProjectModuleRoutes(app: FastifyInstance) {
  const projectRepository = createProjectRepository(app.prisma)
  const projectSettingsRepository = createProjectSettingsRepository(app.prisma)

  const projectService = createProjectService({
    projectRepository,
  })
  const projectSettingsService = createProjectSettingsService({
    projectSettingsRepository,
  })

  await registerProjectRoutes(app, {
    projectService,
    projectSettingsService,
  })
}
