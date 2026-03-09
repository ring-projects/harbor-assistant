export type {
  CodexTask,
  TaskConversation,
  TaskConversationMessage,
  TaskEvent,
  TaskEventType,
  TaskMessageRole,
  TaskStatus,
} from "./types"

export { TaskError, createTaskError } from "./errors"
export type { TaskErrorCode } from "./errors"

export { createTaskRepository } from "./repositories"
export type {
  AppendTaskEventInput,
  AppendTaskMessageInput,
  AttachThreadToTaskInput,
  CreateTaskInput as CreateTaskRecordInput,
  ListTaskEventsInput as ListTaskEventsRepositoryInput,
  ListTasksByProjectInput as ListTasksByProjectRepositoryInput,
  ReadTaskConversationInput,
  TaskDbClient,
  TaskRepository,
  UpdateTaskRunStateInput,
} from "./repositories"

export { createTaskAgentGateway } from "./gateways"
export type { TaskAgentGateway } from "./gateways"

export {
  createTaskConversationService,
  createTaskRunnerService,
  createTaskService,
} from "./services"
export type {
  CancelTaskInput,
  CreateTaskInput,
  FollowupTaskInput,
  GetTaskConversationInput,
  GetTaskEventsInput,
  ListProjectTasksInput,
  RetryTaskInput,
  TaskConversationService,
  TaskRunnerService,
  TaskService,
} from "./services"

export { registerTaskModuleRoutes } from "./routes"

import { createProjectRepository } from "../project"
import { createTaskAgentGateway } from "./gateways"
import { createTaskRepository } from "./repositories"
import type { TaskDbClient } from "./repositories"
import {
  createTaskConversationService,
  createTaskRunnerService,
  createTaskService,
} from "./services"

export function createTaskModule(args: { prisma: TaskDbClient }) {
  const projectRepository = createProjectRepository(args.prisma)
  const taskRepository = createTaskRepository(args.prisma)
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

  return {
    repositories: {
      projectRepository,
      taskRepository,
    },
    services: {
      taskConversationService,
      taskRunnerService,
      taskService,
    },
    gateways: {
      taskAgentGateway,
    },
  }
}
