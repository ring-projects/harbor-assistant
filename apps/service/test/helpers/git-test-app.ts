import type { PrismaClient } from "@prisma/client"
import Fastify from "fastify"

import { createGitCommandRepository } from "../../src/modules/git/infrastructure/git-command-repository"
import { registerGitModuleRoutes } from "../../src/modules/git/routes"
import { PrismaProjectRepository } from "../../src/modules/project/infrastructure/persistence/prisma-project-repository"
import { createSimpleProjectPathPolicy } from "../../src/modules/project/infrastructure/simple-project-path-policy"
import { registerProjectModuleRoutes } from "../../src/modules/project/routes"
import errorHandlerPlugin from "../../src/plugins/error-handler"

export async function createGitTestApp(prisma: PrismaClient) {
  const projectRepository = new PrismaProjectRepository(prisma)
  const app = Fastify({
    logger: false,
  })

  app.decorate("prisma", prisma)
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerProjectModuleRoutes(instance, {
        repository: projectRepository,
        pathPolicy: createSimpleProjectPathPolicy(),
      })
      await registerGitModuleRoutes(instance, {
        projectRepository,
        gitRepository: createGitCommandRepository(),
      })
    },
    {
      prefix: "/v1",
    },
  )
  await app.ready()

  return app
}
