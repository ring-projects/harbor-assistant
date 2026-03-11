import type { FastifyInstance } from "fastify"

import { createProjectRepository } from "../../project"
import { createGitRepository } from "../repositories"
import { createGitService } from "../services"
import { registerGitRoutes } from "./git.routes"

export async function registerGitModuleRoutes(app: FastifyInstance) {
  const projectRepository = createProjectRepository(app.prisma)
  const gitRepository = createGitRepository()
  const gitService = createGitService({
    projectRepository,
    gitRepository,
  })

  await registerGitRoutes(app, {
    gitService,
  })
}
