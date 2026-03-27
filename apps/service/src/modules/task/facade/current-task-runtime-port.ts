import type { PrismaClient } from "@prisma/client"

import {
  AgentFactory,
  type AgentType,
  type IAgentRuntime,
} from "../../../lib/agents"
import type { TaskNotificationPublisher } from "../application/task-notification"
import type { TaskRepository } from "../application/task-repository"
import type { TaskRuntimePort } from "../application/task-runtime-port"
import { normalizeAgentType } from "../infrastructure/runtime/normalize-agent-events"
import { createTaskExecutionDriver } from "../infrastructure/runtime/task-execution-driver"

export function createCurrentTaskRuntimePort(args: {
  prisma: PrismaClient
  taskRepository: Pick<TaskRepository, "findById">
  notificationPublisher: TaskNotificationPublisher
  harborApiBaseUrl?: string
  logger?: Pick<Console, "error" | "warn">
  resolveAgentRuntime?: (type: AgentType) => IAgentRuntime
}): TaskRuntimePort {
  const resolveAgentRuntime =
    args.resolveAgentRuntime ?? ((type: AgentType) => AgentFactory.getRuntime(type))
  const executionDriver = createTaskExecutionDriver({
    prisma: args.prisma,
    taskRepository: args.taskRepository,
    notificationPublisher: args.notificationPublisher,
    harborApiBaseUrl: args.harborApiBaseUrl,
    logger: args.logger,
  })

  return {
    async startTaskExecution(input) {
      const agentType = normalizeAgentType(input.runtimeConfig.executor)
      const agentRuntime = resolveAgentRuntime(agentType)
      await executionDriver.startExecution({
        ...input,
        agentType,
        agentRuntime,
      })
    },
    async resumeTaskExecution(input) {
      const executionRecord = await args.prisma.execution.findUnique({
        where: {
          ownerId: input.taskId,
        },
        select: {
          executorType: true,
          executorModel: true,
          executionMode: true,
          sessionId: true,
        },
      })

      if (!executionRecord) {
        throw new Error(`Execution for task ${input.taskId} was not found.`)
      }

      if (!executionRecord.sessionId) {
        throw new Error(`Execution for task ${input.taskId} has no resumable session.`)
      }

      const agentType = normalizeAgentType(executionRecord.executorType)
      const capability = await AgentFactory.getCapability(agentType).inspect()
      if (!capability.supportsResume) {
        throw new Error(`${executionRecord.executorType} does not support resume.`)
      }

      const agentRuntime = resolveAgentRuntime(agentType)
      await executionDriver.resumeExecution({
        taskId: input.taskId,
        projectId: input.projectId,
        projectPath: input.projectPath,
        prompt: input.prompt,
        runtimeConfig: {
          executor: executionRecord.executorType,
          model: executionRecord.executorModel,
          executionMode: executionRecord.executionMode,
        },
        sessionId: executionRecord.sessionId,
        agentType,
        agentRuntime,
      })
    },
  }
}
