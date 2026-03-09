import type { FastifyInstance } from "fastify"

import { createProjectRepository } from "../../project"
import { createTaskAgentGateway } from "../gateways"
import { createTaskRepository } from "../repositories"
import {
  createTaskConversationService,
  createTaskRunnerService,
  createTaskService,
} from "../services"
import { registerTaskRoutes } from "./tasks.routes"

export async function registerTaskModuleRoutes(app: FastifyInstance) {
  const projectRepository = createProjectRepository(app.prisma)
  const taskRepository = createTaskRepository(app.prisma)

  const taskAgentGateway = createTaskAgentGateway({
    taskRepository,
  })
  const taskConversationService = createTaskConversationService({
    taskRepository,
  })
  const taskRunnerService = createTaskRunnerService({
    taskRepository,
    taskAgentGateway,
  })
  const taskService = createTaskService({
    projectRepository,
    taskRepository,
    taskRunnerService,
    taskConversationService,
  })

  await registerTaskRoutes(app, {
    taskService,
  })
}
