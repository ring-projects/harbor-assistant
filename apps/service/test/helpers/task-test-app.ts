import type { PrismaClient } from "@prisma/client"
import Fastify from "fastify"

import errorHandlerPlugin from "../../src/plugins/error-handler"
import { createCurrentTaskRuntimePort } from "../../src/modules/task/facade/current-task-runtime-port"
import { PrismaTaskEventProjection } from "../../src/modules/task/infrastructure/projection/prisma-task-event-projection"
import { PrismaTaskRepository } from "../../src/modules/task/infrastructure/persistence/prisma-task-repository"
import { createInMemoryTaskNotificationBus } from "../../src/modules/task/infrastructure/notification/in-memory-task-notification-bus"
import { registerTaskModuleRoutes } from "../../src/modules/task/routes"
import { PrismaProjectRepository } from "../../src/modules/project/infrastructure/persistence/prisma-project-repository"
import { createProjectTaskPort } from "../../src/routes/v1/create-project-task-port"

export async function createTaskTestApp(prisma: PrismaClient) {
  return createTaskTestAppWithOptions(prisma)
}

export async function createTaskTestAppWithOptions(
  prisma: PrismaClient,
  options?: {
    harborApiBaseUrl?: string
  },
) {
  const taskRepository = new PrismaTaskRepository(prisma)
  const eventProjection = new PrismaTaskEventProjection(prisma)
  const notificationBus = createInMemoryTaskNotificationBus()
  const projectTaskPort = createProjectTaskPort({
    projectRepository: new PrismaProjectRepository(prisma),
  })
  const runtimePort = createCurrentTaskRuntimePort({
    prisma,
    taskRepository,
    notificationPublisher: notificationBus.publisher,
    harborApiBaseUrl: options?.harborApiBaseUrl,
  })
  const app = Fastify({
    logger: false,
  })

  app.decorate("prisma", prisma)
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerTaskModuleRoutes(instance, {
        repository: taskRepository,
        taskRecordStore: taskRepository,
        eventProjection,
        notificationPublisher: notificationBus.publisher,
        projectTaskPort,
        runtimePort,
      })
    },
    {
      prefix: "/v1",
    },
  )
  await app.ready()

  return app
}
