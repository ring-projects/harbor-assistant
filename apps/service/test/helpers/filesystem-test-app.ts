import Fastify from "fastify"

import { createNodeFileSystemRepository } from "../../src/modules/filesystem/infrastructure/node-filesystem-repository"
import { registerFileSystemModuleRoutes } from "../../src/modules/filesystem/routes"
import { InMemoryProjectRepository } from "../../src/modules/project/infrastructure/in-memory-project-repository"
import errorHandlerPlugin from "../../src/plugins/error-handler"

export async function createFileSystemTestApp() {
  const app = Fastify({
    logger: false,
  })

  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerFileSystemModuleRoutes(instance, {
        projectRepository: new InMemoryProjectRepository(),
        fileSystemRepository: createNodeFileSystemRepository(),
      })
    },
    {
      prefix: "/v1",
    },
  )

  await app.ready()
  return app
}
