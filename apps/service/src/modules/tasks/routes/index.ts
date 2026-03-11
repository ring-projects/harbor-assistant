import type { FastifyInstance } from "fastify"

import { createProjectRepository } from "../../project"
import { createTaskAgentGateway } from "../gateways"
import { createTaskRepository } from "../repositories"
import {
  createTaskEventBus,
  createTaskRunnerService,
  createTaskService,
} from "../services"
import { registerTaskRoutes } from "./tasks.routes"
import { registerTaskWebsocketRoutes } from "./tasks.websocket.routes"

export async function registerTaskModuleRoutes(app: FastifyInstance) {
  const projectRepository = createProjectRepository(app.prisma)
  const taskRepository = createTaskRepository(app.prisma)
  const taskEventBus = createTaskEventBus()

  const taskAgentGateway = createTaskAgentGateway({
    taskRepository,
    taskEventBus,
  })
  const taskRunnerService = createTaskRunnerService({
    taskRepository,
    taskAgentGateway,
    taskEventBus,
  })
  const taskService = createTaskService({
    projectRepository,
    taskRepository,
    taskRunnerService,
  })

  await registerTaskRoutes(app, {
    taskService,
  })
  await registerTaskWebsocketRoutes(app, {
    taskService,
    taskEventBus,
  })
}
