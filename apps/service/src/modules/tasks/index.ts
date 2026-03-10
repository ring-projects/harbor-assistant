export type {
  CodexTask,
  TaskMessageRole,
  TaskStatus,
  TaskTimeline,
  TaskTimelineItem,
  TaskTimelineItemKind,
} from "./types"

export { TaskError, createTaskError } from "./errors"
export type { TaskErrorCode } from "./errors"

export { createTaskRepository } from "./repositories"
export type {
  AppendTimelineItemInput,
  CreateTaskInput as CreateTaskRecordInput,
  ListTaskTimelineInput as ListTaskTimelineRepositoryInput,
  ListTasksByProjectInput as ListTasksByProjectRepositoryInput,
  SetTaskThreadIdInput,
  TaskDbClient,
  TaskRepository,
  UpdateTaskStateInput,
} from "./repositories"

export { createTaskAgentGateway } from "./gateways"
export type { TaskAgentGateway } from "./gateways"

export {
  createTaskRunnerService,
  createTaskService,
} from "./services"
export type {
  CancelTaskInput,
  CreateTaskInput,
  FollowupTaskInput,
  GetTaskDiffInput,
  GetTaskTimelineInput,
  ListProjectTasksInput,
  RetryTaskInput,
  TaskRunnerService,
  TaskService,
} from "./services"

export { registerTaskModuleRoutes } from "./routes"

import { createProjectRepository } from "../project"
import { createTaskAgentGateway } from "./gateways"
import { createTaskRepository } from "./repositories"
import type { TaskDbClient } from "./repositories"
import {
  createTaskRunnerService,
  createTaskService,
} from "./services"

export function createTaskModule(args: { prisma: TaskDbClient }) {
  const projectRepository = createProjectRepository(args.prisma)
  const taskRepository = createTaskRepository(args.prisma)
  const taskAgentGateway = createTaskAgentGateway({
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
  })

  return {
    repositories: {
      projectRepository,
      taskRepository,
    },
    services: {
      taskRunnerService,
      taskService,
    },
    gateways: {
      taskAgentGateway,
    },
  }
}
