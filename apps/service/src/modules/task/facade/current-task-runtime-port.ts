import type { PrismaClient } from "@prisma/client"

import type { AgentType, IAgentRuntime } from "../../../lib/agents"
import type { TaskNotificationPublisher } from "../application/task-notification"
import type { TaskRepository } from "../application/task-repository"
import type { TaskRuntimePort } from "../application/task-runtime-port"
import { createTaskExecutionLifecycle } from "../infrastructure/runtime/task-execution-lifecycle"

export function createCurrentTaskRuntimePort(args: {
  prisma: PrismaClient
  taskRepository: Pick<TaskRepository, "findById">
  notificationPublisher: TaskNotificationPublisher
  harborApiBaseUrl?: string
  logger?: Pick<Console, "error" | "warn">
  resolveAgentRuntime?: (type: AgentType) => IAgentRuntime
}): TaskRuntimePort {
  const runtimeLifecycle = createTaskExecutionLifecycle(args)

  return {
    startTaskExecution: runtimeLifecycle.startTaskExecution,
    resumeTaskExecution: runtimeLifecycle.resumeTaskExecution,
    cancelTaskExecution: runtimeLifecycle.cancelTaskExecution,
  }
}
