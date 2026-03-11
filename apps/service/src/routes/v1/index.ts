import type { FastifyInstance } from "fastify"

import { registerFileSystemModuleRoutes } from "../../modules/filesystem"
import { registerGitModuleRoutes } from "../../modules/git"
import { registerProjectModuleRoutes } from "../../modules/project"
import { registerTaskModuleRoutes } from "../../modules/tasks"
import type { ServiceConfig } from "../../config"

export async function registerV1Routes(
  app: FastifyInstance,
  config: ServiceConfig,
) {
  await registerProjectModuleRoutes(app)
  await registerGitModuleRoutes(app)
  await registerFileSystemModuleRoutes(app, {
    rootDirectory: config.fileBrowserRootDirectory,
  })
  await registerTaskModuleRoutes(app)
}
