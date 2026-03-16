import type { FastifyInstance } from "fastify"

import {
  createProjectRepository,
  createProjectSettingsRepository,
  createProjectSkillBridgeService,
} from "../../project"
import { createProjectGitWatcher } from "../../git"
import { createTaskAgentGateway } from "../gateways"
import { createTaskRepository } from "../repositories"
import {
  createTaskEventBus,
  createTaskRunnerService,
  createTaskService,
} from "../services"
import { createTaskSocketGateway } from "../realtime/task-socket.gateway"
import { registerTaskRoutes } from "./tasks.routes"

export async function registerTaskModuleRoutes(
  app: FastifyInstance,
  args?: {
    harborHomeDirectory?: string
    harborApiBaseUrl?: string
  },
) {
  const projectRepository = createProjectRepository(app.prisma)
  const projectSettingsRepository = createProjectSettingsRepository(app.prisma)
  const taskRepository = createTaskRepository(app.prisma)
  const taskEventBus = createTaskEventBus()
  const projectSkillBridgeService = args?.harborHomeDirectory
    ? createProjectSkillBridgeService({
        harborHomeDirectory: args.harborHomeDirectory,
        projectRepository,
      })
    : undefined
  const projectGitWatcher = createProjectGitWatcher({
    projectRepository,
  })

  const taskAgentGateway = createTaskAgentGateway({
    taskRepository,
    taskEventBus,
    harborApiBaseUrl: args?.harborApiBaseUrl,
  })
  const taskRunnerService = createTaskRunnerService({
    taskRepository,
    taskAgentGateway,
    taskEventBus,
    logger: app.log,
  })
  const taskService = createTaskService({
    projectRepository,
    projectSettingsRepository,
    projectSkillBridgeService,
    taskRepository,
    taskRunnerService,
    taskEventBus,
  })

  const recoveredTasks = await taskRunnerService.recoverInterruptedTasks()
  if (recoveredTasks.length > 0) {
    app.log.warn(
      {
        recoveredTaskIds: recoveredTasks.map((task) => task.id),
      },
      "Recovered interrupted tasks after Harbor service restart",
    )
  }

  await registerTaskRoutes(app, {
    taskService,
  })
  createTaskSocketGateway({
    app,
    taskService,
    taskEventBus,
    projectGitWatcher,
  })
}
