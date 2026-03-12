import type { PrismaClient } from "@prisma/client"
import Fastify from "fastify"

import errorHandlerPlugin from "../../src/plugins/error-handler"
import { registerTaskModuleRoutes } from "../../src/modules/tasks"

export async function createTaskTestApp(prisma: PrismaClient) {
  return createTaskTestAppWithOptions(prisma)
}

export async function createTaskTestAppWithOptions(
  prisma: PrismaClient,
  options?: {
    harborHomeDirectory?: string
  },
) {
  const app = Fastify({
    logger: false,
  })

  app.decorate("prisma", prisma)
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerTaskModuleRoutes(instance, {
        harborHomeDirectory: options?.harborHomeDirectory,
      })
    },
    {
      prefix: "/v1",
    },
  )
  await app.ready()

  return app
}
