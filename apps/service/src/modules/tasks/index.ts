export type {
  TaskAgentEvent,
  TaskAgentEventStream,
  TaskAgentEventType,
  CodexTask,
  TaskMessageRole,
  TaskStatus,
} from "./types"
export {
  inferExecutionMode,
  normalizeRuntimePolicy,
  parseRuntimePolicy,
  resolveRuntimePolicy,
  RUNTIME_POLICY_PRESETS,
  runtimePolicyToSessionOptions,
  serializeRuntimePolicy,
} from "./runtime-policy"
export type {
  RuntimeApprovalPolicy,
  RuntimeExecutionMode,
  RuntimePolicy,
  RuntimePolicyInput,
  RuntimeSandboxMode,
  RuntimeWebSearchMode,
} from "./runtime-policy"

export { TaskError, createTaskError } from "./errors"
export type { TaskErrorCode } from "./errors"

export { createTaskRepository } from "./repositories"
export type {
  AppendTaskAgentEventInput,
  CreateTaskInput as CreateTaskRecordInput,
  ListTaskAgentEventsInput as ListTaskAgentEventsRepositoryInput,
  ListTasksByProjectInput as ListTasksByProjectRepositoryInput,
  ListTasksByStatusesInput as ListTasksByStatusesRepositoryInput,
  SetTaskThreadIdInput,
  TaskDbClient,
  TaskRepository,
  UpdateTaskStateInput,
} from "./repositories"

export { createTaskAgentGateway } from "./gateways"
export type { TaskAgentGateway } from "./gateways"

export {
  createTaskEventBus,
  createTaskRunnerService,
  createTaskService,
} from "./services"
export type {
  BreakTaskTurnInput,
  CreateTaskInput,
  GetTaskEventsInput,
  FollowupTaskInput,
  ListProjectTasksInput,
  RetryTaskInput,
  TaskEventBus,
  TaskRunnerService,
  TaskService,
  TaskStreamEvent,
} from "./services"

export { registerTaskModuleRoutes } from "./routes"

import {
  createProjectRepository,
  createProjectSettingsRepository,
  createProjectSkillBridgeService,
} from "../project"
import { createTaskAgentGateway } from "./gateways"
import { createTaskRepository } from "./repositories"
import type { TaskDbClient } from "./repositories"
import {
  createTaskEventBus,
  createTaskRunnerService,
  createTaskService,
} from "./services"

export function createTaskModule(args: {
  prisma: TaskDbClient
  harborHomeDirectory: string
  harborApiBaseUrl?: string
}) {
  const projectRepository = createProjectRepository(args.prisma)
  const projectSettingsRepository = createProjectSettingsRepository(args.prisma)
  const projectSkillBridgeService = createProjectSkillBridgeService({
    harborHomeDirectory: args.harborHomeDirectory,
    projectRepository,
  })
  const taskRepository = createTaskRepository(args.prisma)
  const taskEventBus = createTaskEventBus()
  const taskAgentGateway = createTaskAgentGateway({
    taskRepository,
    taskEventBus,
    harborApiBaseUrl: args.harborApiBaseUrl,
  })
  const taskRunnerService = createTaskRunnerService({
    taskRepository,
    taskAgentGateway,
    taskEventBus,
  })
  const taskService = createTaskService({
    projectRepository,
    projectSettingsRepository,
    projectSkillBridgeService,
    taskRepository,
    taskRunnerService,
    taskEventBus,
  })

  return {
    repositories: {
      projectRepository,
      projectSettingsRepository,
      projectSkillBridgeService,
      taskRepository,
    },
    services: {
      taskRunnerService,
      taskService,
    },
    gateways: {
      taskAgentGateway,
    },
    eventBus: {
      taskEventBus,
    },
  }
}
