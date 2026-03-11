import type { PrismaClient } from "@prisma/client"
import Fastify from "fastify"

import errorHandlerPlugin from "../../src/plugins/error-handler"
import { registerGitModuleRoutes } from "../../src/modules/git"
import { registerProjectModuleRoutes } from "../../src/modules/project"

export async function createGitTestApp(prisma: PrismaClient) {
  const app = Fastify({
    logger: false,
  })

  app.decorate("prisma", prisma)
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerProjectModuleRoutes(instance)
      await registerGitModuleRoutes(instance)
    },
    {
      prefix: "/v1",
    },
  )
  await app.ready()

  return app
}
