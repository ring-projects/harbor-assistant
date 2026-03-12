import type { FastifyInstance } from "fastify"

import {
  createProjectRepository,
  createProjectSettingsRepository,
} from "../../project"
import { createTaskAgentGateway } from "../gateways"
import { createTaskRepository } from "../repositories"
import {
  createTaskEventBus,
  createTaskRunnerService,
  createTaskService,
} from "../services"
import { createTaskSocketGateway } from "../realtime/task-socket.gateway"
import { registerTaskRoutes } from "./tasks.routes"

export async function registerTaskModuleRoutes(app: FastifyInstance) {
  const projectRepository = createProjectRepository(app.prisma)
  const projectSettingsRepository = createProjectSettingsRepository(app.prisma)
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
    projectSettingsRepository,
    taskRepository,
    taskRunnerService,
  })

  await registerTaskRoutes(app, {
    taskService,
  })
  createTaskSocketGateway({
    app,
    taskService,
    taskEventBus,
  })
}
