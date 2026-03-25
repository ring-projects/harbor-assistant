import type { PrismaClient } from "@prisma/client"
import Fastify from "fastify"

import { InMemoryProjectRepository } from "../../src/modules/project/infrastructure/in-memory-project-repository"
import { PrismaProjectRepository } from "../../src/modules/project/infrastructure/persistence/prisma-project-repository"
import { createSimpleProjectPathPolicy } from "../../src/modules/project/infrastructure/simple-project-path-policy"
import { registerProjectModuleRoutes } from "../../src/modules/project/routes"
import errorHandlerPlugin from "../../src/plugins/error-handler"

export async function createProjectTestApp(prisma: PrismaClient) {
  const repository = prisma
    ? new PrismaProjectRepository(prisma)
    : new InMemoryProjectRepository()
  const app = Fastify({
    logger: false,
  })

  app.decorate("prisma", prisma)
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerProjectModuleRoutes(instance, {
        repository,
        pathPolicy: createSimpleProjectPathPolicy(),
      })
    },
    {
      prefix: "/v1",
    },
  )
  await app.ready()

  return app
}
