import type { PrismaClient } from "@prisma/client"
import Fastify from "fastify"

import {
  createDefaultAuthorizationService,
  createRepositoryAuthorizationOrchestrationQuery,
  createRepositoryAuthorizationProjectQuery,
  createRepositoryAuthorizationTaskQuery,
  createRepositoryAuthorizationWorkspaceQuery,
} from "../../src/modules/authorization"
import errorHandlerPlugin from "../../src/plugins/error-handler"
import { PrismaOrchestrationRepository } from "../../src/modules/orchestration/infrastructure/persistence/prisma-orchestration-repository"
import { createCurrentTaskRuntimePort } from "../../src/modules/task/facade/current-task-runtime-port"
import { PrismaTaskEventProjection } from "../../src/modules/task/infrastructure/projection/prisma-task-event-projection"
import { PrismaTaskRepository } from "../../src/modules/task/infrastructure/persistence/prisma-task-repository"
import { createNodeTaskInputImageStore } from "../../src/modules/task/infrastructure/node-task-input-image-store"
import { createInMemoryTaskNotificationBus } from "../../src/modules/task/infrastructure/notification/in-memory-task-notification-bus"
import { registerTaskModuleRoutes } from "../../src/modules/task/routes"
import { PrismaProjectRepository } from "../../src/modules/project/infrastructure/persistence/prisma-project-repository"
import { PrismaWorkspaceRepository } from "../../src/modules/workspace"
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
  const projectRepository = new PrismaProjectRepository(prisma)
  const orchestrationRepository = new PrismaOrchestrationRepository(prisma)
  const eventProjection = new PrismaTaskEventProjection(prisma)
  const notificationBus = createInMemoryTaskNotificationBus()
  const workspaceRepository = new PrismaWorkspaceRepository(prisma)
  const projectTaskPort = createProjectTaskPort({
    projectRepository,
  })
  const authorization = createDefaultAuthorizationService({
    workspaceQuery: createRepositoryAuthorizationWorkspaceQuery(
      workspaceRepository,
    ),
    projectQuery: createRepositoryAuthorizationProjectQuery(projectRepository),
    taskQuery: createRepositoryAuthorizationTaskQuery(taskRepository),
    orchestrationQuery:
      createRepositoryAuthorizationOrchestrationQuery(orchestrationRepository),
  })
  const taskInputFileStore = createNodeTaskInputImageStore()
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
  app.decorateRequest("auth", null)
  app.addHook("onRequest", async (request) => {
    request.auth = {
      sessionId: "session-test",
      userId: "user-1",
      user: {
        id: "user-1",
        githubLogin: "user-1",
        name: "User One",
        email: "user-1@example.com",
        avatarUrl: null,
        status: "active",
        lastLoginAt: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    }
  })
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerTaskModuleRoutes(instance, {
        authorization,
        repository: taskRepository,
        taskRecordStore: taskRepository,
        eventProjection,
        notificationPublisher: notificationBus.publisher,
        projectRepository,
        workspaceRepository,
        projectTaskPort,
        taskInputFileStore,
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
