import type { FastifyInstance } from "fastify"

import { createProjectRepository } from "../repositories"
import { createProjectService } from "../services"
import { registerProjectRoutes } from "./project.routes"

export async function registerProjectModuleRoutes(app: FastifyInstance) {
  const projectRepository = createProjectRepository(app.prisma)

  const projectService = createProjectService({
    projectRepository,
  })

  await registerProjectRoutes(app, {
    projectService,
  })
}
