import type { PrismaClient } from "@prisma/client"

import type { AgentType, IAgentRuntime } from "../../../lib/agents"
import type { PrismaAgentTokenStore } from "../../auth"
import type { ProjectRepository } from "../../project"
import {
  createConfiguredSandboxServices,
  type SandboxProvisioningPort,
  type SandboxRegistry,
} from "../../sandbox"
import type { TaskNotificationPublisher } from "../application/task-notification"
import type { TaskRepository } from "../application/task-repository"
import type { TaskRuntimePort } from "../application/task-runtime-port"
import { createTaskExecutionLifecycle } from "../infrastructure/runtime/task-execution-lifecycle"

export function createCurrentTaskRuntimePort(args: {
  prisma: PrismaClient
  taskRepository: Pick<TaskRepository, "findById">
  projectRepository?: Pick<ProjectRepository, "findById">
  notificationPublisher: TaskNotificationPublisher
  harborApiBaseUrl?: string
  sandbox?: {
    provider: SandboxProvisioningPort
    registry: SandboxRegistry
  }
  sandboxRootDirectory?: string
  publicSkillsRootDirectory?: string
  agentTokenStore?: PrismaAgentTokenStore
  logger?: Pick<Console, "error" | "warn">
  resolveAgentRuntime?: (type: AgentType) => IAgentRuntime
}): TaskRuntimePort {
  const sandboxServices =
    args.sandbox ??
    createConfiguredSandboxServices({
      prisma: args.prisma,
      sandboxRootDirectory: args.sandboxRootDirectory,
      logger: args.logger,
    })
  const runtimeLifecycle = createTaskExecutionLifecycle({
    ...args,
    sandboxProvider: sandboxServices.provider,
    sandboxRegistry: sandboxServices.registry,
  })

  return {
    startTaskExecution: runtimeLifecycle.startTaskExecution,
    resumeTaskExecution: runtimeLifecycle.resumeTaskExecution,
    cancelTaskExecution: runtimeLifecycle.cancelTaskExecution,
  }
}
