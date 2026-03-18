import type { FastifyInstance } from "fastify"

import { registerAgentRoutes } from "./agent.routes"
import { registerFileSystemModuleRoutes } from "../../modules/filesystem"
import { registerGitModuleRoutes } from "../../modules/git"
import { registerProjectModuleRoutes } from "../../modules/project"
import { registerTaskModuleRoutes } from "../../modules/tasks"
import type { ServiceConfig } from "../../config"

function resolveHarborApiBaseUrl(config: ServiceConfig) {
  const normalizedHost =
    config.host === "0.0.0.0" || config.host === "::" ? "127.0.0.1" : config.host
  return `http://${normalizedHost}:${config.port}/v1`
}

export async function registerV1Routes(
  app: FastifyInstance,
  config: ServiceConfig,
) {
  await registerAgentRoutes(app)
  await registerProjectModuleRoutes(app, {
    harborHomeDirectory: config.harborHomeDirectory,
  })
  await registerGitModuleRoutes(app)
  await registerFileSystemModuleRoutes(app, {
    rootDirectory: config.fileBrowserRootDirectory,
  })
  await registerTaskModuleRoutes(app, {
    harborHomeDirectory: config.harborHomeDirectory,
    harborApiBaseUrl: resolveHarborApiBaseUrl(config),
  })
}
