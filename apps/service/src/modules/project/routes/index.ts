import type { FastifyInstance } from "fastify"

import {
  createProjectRepository,
  createProjectSettingsRepository,
} from "../repositories"
import {
  createProjectService,
  createProjectSettingsService,
  createProjectSkillBridgeService,
} from "../services"
import { registerProjectRoutes } from "./project.routes"

export async function registerProjectModuleRoutes(
  app: FastifyInstance,
  args?: {
    harborHomeDirectory?: string
  },
) {
  const projectRepository = createProjectRepository(app.prisma)
  const projectSettingsRepository = createProjectSettingsRepository(app.prisma)
  const projectSkillBridgeService = args?.harborHomeDirectory
    ? createProjectSkillBridgeService({
        harborHomeDirectory: args.harborHomeDirectory,
        projectRepository,
      })
    : undefined

  const projectService = createProjectService({
    projectRepository,
    projectSettingsRepository,
    projectSkillBridgeService,
  })
  const projectSettingsService = createProjectSettingsService({
    projectSettingsRepository,
    projectSkillBridgeService,
  })

  await registerProjectRoutes(app, {
    projectService,
    projectSettingsService,
  })
}
