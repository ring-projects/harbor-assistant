import type { PrismaClient } from "@prisma/client"
import type { FastifyInstance } from "fastify"

import { registerAgentRoutes } from "./agent.routes"
import type { ServiceConfig } from "../../config"
import { createNodeFileSystemRepository } from "../../modules/filesystem/infrastructure/node-filesystem-repository"
import { registerFileSystemModuleRoutes } from "../../modules/filesystem/routes"
import { createGitCommandRepository } from "../../modules/git/infrastructure/git-command-repository"
import { createNodeGitPathWatcher } from "../../modules/git/infrastructure/node-git-path-watcher"
import { registerGitModuleRoutes } from "../../modules/git/routes"
import { createInteractionSocketGateway } from "../../modules/interaction/infrastructure/socket-io-gateway"
import { InMemoryProjectRepository } from "../../modules/project/infrastructure/in-memory-project-repository"
import { createNodeProjectPathPolicy } from "../../modules/project/infrastructure/node-project-path-policy"
import { PrismaProjectRepository } from "../../modules/project/infrastructure/persistence/prisma-project-repository"
import { registerProjectModuleRoutes } from "../../modules/project/routes"
import { createCurrentTaskRuntimePort } from "../../modules/task/facade/current-task-runtime-port"
import { createNoopTaskRuntimePort } from "../../modules/task/facade/noop-task-runtime-port"
import { InMemoryTaskEventProjection } from "../../modules/task/infrastructure/in-memory-task-event-projection"
import { InMemoryTaskRepository } from "../../modules/task/infrastructure/in-memory-task-repository"
import { createInMemoryTaskNotificationBus } from "../../modules/task/infrastructure/notification/in-memory-task-notification-bus"
import { PrismaTaskRepository } from "../../modules/task/infrastructure/persistence/prisma-task-repository"
import { PrismaTaskEventProjection } from "../../modules/task/infrastructure/projection/prisma-task-event-projection"
import { registerTaskModuleRoutes } from "../../modules/task/routes"
import { createProjectGitInteractionLifecycle } from "./create-project-git-interaction-lifecycle"
import { createTaskInteractionService } from "./create-task-interaction-service"
import { createProjectTaskPort } from "./create-project-task-port"

function resolveHarborApiBaseUrl(config: ServiceConfig) {
  const normalizedHost =
    config.host === "0.0.0.0" || config.host === "::" ? "127.0.0.1" : config.host
  return `http://${normalizedHost}:${config.port}/v1`
}

export async function registerV1Routes(
  app: FastifyInstance,
  config: ServiceConfig,
) {
  const prisma = (app as FastifyInstance & { prisma?: PrismaClient }).prisma
  const projectRepository = prisma
    ? new PrismaProjectRepository(prisma)
    : new InMemoryProjectRepository()
  const taskRepository = prisma
    ? new PrismaTaskRepository(prisma)
    : new InMemoryTaskRepository()
  const taskEventProjection = prisma
    ? new PrismaTaskEventProjection(prisma)
    : new InMemoryTaskEventProjection()
  const taskNotificationBus = createInMemoryTaskNotificationBus()
  const projectTaskPort = createProjectTaskPort({
    projectRepository,
  })
  const taskRuntimePort = prisma
    ? createCurrentTaskRuntimePort({
        prisma,
        taskRepository,
        notificationPublisher: taskNotificationBus.publisher,
        harborApiBaseUrl: resolveHarborApiBaseUrl(config),
        logger: app.log,
      })
    : createNoopTaskRuntimePort()
  const taskInteractionService = createTaskInteractionService({
    repository: taskRepository,
    eventProjection: taskEventProjection,
    notificationSubscriber: taskNotificationBus.subscriber,
  })
  const projectPathPolicy = createNodeProjectPathPolicy()
  const gitPathWatcher = createNodeGitPathWatcher()
  const projectGitLifecycle = createProjectGitInteractionLifecycle({
    projectRepository,
    gitPathWatcher,
  })
  const gitRepository = createGitCommandRepository()
  const fileSystemRepository = createNodeFileSystemRepository()
  const bootstrapRoots = [
    {
      id: "default",
      label: "Local Files",
      path: config.fileBrowserRootDirectory,
      isDefault: true,
    },
  ]

  await registerAgentRoutes(app)
  await registerProjectModuleRoutes(app, {
    repository: projectRepository,
    pathPolicy: projectPathPolicy,
  })
  await registerGitModuleRoutes(app, {
    projectRepository,
    gitRepository,
  })
  await registerFileSystemModuleRoutes(app, {
    projectRepository,
    fileSystemRepository,
    bootstrapRoots,
  })
  await registerTaskModuleRoutes(app, {
    repository: taskRepository,
    taskRecordStore: taskRepository,
    eventProjection: taskEventProjection,
    notificationPublisher: taskNotificationBus.publisher,
    projectTaskPort,
    runtimePort: taskRuntimePort,
  })
  createInteractionSocketGateway({
    taskQueries: taskInteractionService.queries,
    taskStream: taskInteractionService.stream,
    projectGitWatcher: projectGitLifecycle,
    app,
  })
}
