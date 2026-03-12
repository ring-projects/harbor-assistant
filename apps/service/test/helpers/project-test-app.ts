import type { PrismaClient } from "@prisma/client"
import Fastify from "fastify"

import errorHandlerPlugin from "../../src/plugins/error-handler"
import { registerProjectModuleRoutes } from "../../src/modules/project"

export async function createProjectTestApp(prisma: PrismaClient) {
  return createProjectTestAppWithOptions(prisma)
}

export async function createProjectTestAppWithOptions(
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
      await registerProjectModuleRoutes(instance, {
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
