import type { PrismaClient } from "@prisma/client"
import Fastify from "fastify"

import errorHandlerPlugin from "../../src/plugins/error-handler"
import { registerTaskModuleRoutes } from "../../src/modules/tasks"

export async function createTaskTestApp(prisma: PrismaClient) {
  const app = Fastify({
    logger: false,
  })

  app.decorate("prisma", prisma)
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerTaskModuleRoutes(instance)
    },
    {
      prefix: "/v1",
    },
  )
  await app.ready()

  return app
}
