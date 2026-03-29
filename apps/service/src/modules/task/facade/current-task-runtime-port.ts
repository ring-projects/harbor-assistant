import type { PrismaClient } from "@prisma/client"

import {
  type AgentInput,
  AgentFactory,
  type AgentType,
  type IAgentRuntime,
} from "../../../lib/agents"
import type { TaskNotificationPublisher } from "../application/task-notification"
import type { TaskRepository } from "../application/task-repository"
import type { TaskRuntimePort } from "../application/task-runtime-port"
import {
  createSyntheticCancelledEvent,
  createSyntheticCancelRequestedEvent,
  createSyntheticErrorEvent,
  createSyntheticUserInputEvent,
  normalizeAgentType,
} from "../infrastructure/runtime/normalize-agent-events"
import { normalizeNullableTaskEffort } from "../domain/task-effort"
import { createTaskExecutionDriver } from "../infrastructure/runtime/task-execution-driver"
import { createTaskExecutionHandleRegistry } from "../infrastructure/runtime/task-execution-handle-registry"
import { createTaskExecutionStateStore } from "../infrastructure/runtime/task-execution-state"

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
  const executionHandleRegistry = createTaskExecutionHandleRegistry()
  const executionDriver = createTaskExecutionDriver({
    prisma: args.prisma,
    taskRepository: args.taskRepository,
    notificationPublisher: args.notificationPublisher,
    executionHandleRegistry,
    harborApiBaseUrl: args.harborApiBaseUrl,
    logger: args.logger,
  })
  const stateStore = createTaskExecutionStateStore({
    prisma: args.prisma,
    taskRepository: args.taskRepository,
    notificationPublisher: args.notificationPublisher,
  })

  async function persistUserInputEvent(input: {
    executionId: string
    taskId: string
    projectId: string
    agentInput: AgentInput
    createdAt?: Date
  }) {
    const event = createSyntheticUserInputEvent({
      input: input.agentInput,
      createdAt: input.createdAt,
    })
    if (!event) {
      throw new Error("task input is required")
    }

    await stateStore.appendEvents({
      executionId: input.executionId,
      taskId: input.taskId,
      projectId: input.projectId,
      source: "harbor",
      nextSequence: await stateStore.getNextSequence(input.executionId),
      events: [event],
    })
  }

  return {
    async startTaskExecution(input) {
      const executionRecord = await args.prisma.execution.findUnique({
        where: {
          ownerId: input.taskId,
        },
        select: {
          id: true,
          sessionId: true,
        },
      })

      if (!executionRecord) {
        throw new Error(`Execution for task ${input.taskId} was not found.`)
      }

      await persistUserInputEvent({
        executionId: executionRecord.id,
        taskId: input.taskId,
        projectId: input.projectId,
        agentInput: input.input,
      })

      try {
        const agentType = normalizeAgentType(input.runtimeConfig.executor)
        const agentRuntime = resolveAgentRuntime(agentType)
        await executionDriver.startExecution({
          ...input,
          agentType,
          agentRuntime,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        const finishedAt = new Date()
        try {
          await stateStore.appendEvents({
            executionId: executionRecord.id,
            taskId: input.taskId,
            projectId: input.projectId,
            source: "harbor",
            nextSequence: await stateStore.getNextSequence(executionRecord.id),
            events: [createSyntheticErrorEvent({ message, createdAt: finishedAt })],
          })
        } catch (appendError) {
          args.logger?.warn?.(
            {
              taskId: input.taskId,
              executionId: executionRecord.id,
              error: appendError,
            },
            "Failed to append synthetic task start failure event",
          )
        }

        await stateStore.markFailed({
          executionId: executionRecord.id,
          taskId: input.taskId,
          finishedAt,
          sessionId: executionRecord.sessionId,
          message,
          expectedExecutionStatuses: ["queued", "running"],
          expectedTaskStatuses: ["queued", "running"],
        })

        throw error
      }
    },
    async resumeTaskExecution(input) {
      const executionRecord = await args.prisma.execution.findUnique({
        where: {
          ownerId: input.taskId,
        },
        select: {
          id: true,
          executorType: true,
          executorModel: true,
          executionMode: true,
          executorEffort: true,
          sessionId: true,
        },
      })

      if (!executionRecord) {
        throw new Error(`Execution for task ${input.taskId} was not found.`)
      }

      if (!executionRecord.sessionId) {
        throw new Error(`Execution for task ${input.taskId} has no resumable session.`)
      }

      await persistUserInputEvent({
        executionId: executionRecord.id,
        taskId: input.taskId,
        projectId: input.projectId,
        agentInput: input.input,
      })

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
        input: input.input,
        runtimeConfig: {
          executor: executionRecord.executorType,
          model: executionRecord.executorModel,
          executionMode: executionRecord.executionMode,
          effort: normalizeNullableTaskEffort(executionRecord.executorEffort),
        },
        sessionId: executionRecord.sessionId,
        agentType,
        agentRuntime,
      })
    },
    async cancelTaskExecution(input) {
      const executionRecord = await args.prisma.execution.findUnique({
        where: {
          ownerId: input.taskId,
        },
        select: {
          id: true,
          ownerId: true,
          status: true,
          sessionId: true,
          task: {
            select: {
              projectId: true,
              status: true,
            },
          },
        },
      })

      if (!executionRecord) {
        throw new Error(`Execution for task ${input.taskId} was not found.`)
      }

      const handle = executionHandleRegistry.get(input.taskId)
      if (handle?.cancelRequestedAt) {
        await handle.completion
        return
      }

      if (!handle) {
        if (
          executionRecord.status !== "running" ||
          executionRecord.task.status !== "running"
        ) {
          return
        }
      }

      const reason = input.reason?.trim() || "User requested stop"
      const requestedAt = new Date()
      let nextSequence = await stateStore.getNextSequence(executionRecord.id)

      nextSequence = await stateStore.appendEvents({
        executionId: executionRecord.id,
        taskId: input.taskId,
        projectId: executionRecord.task.projectId,
        source: "harbor",
        nextSequence,
        events: [
          createSyntheticCancelRequestedEvent({
            reason,
            createdAt: requestedAt,
          }),
        ],
      })

      if (!handle) {
        const finishedAt = new Date()
        const cancelled = await stateStore.markCancelled({
          executionId: executionRecord.id,
          taskId: input.taskId,
          finishedAt,
          sessionId: executionRecord.sessionId,
        })

        if (!cancelled) {
          return
        }

        await stateStore.appendEvents({
          executionId: executionRecord.id,
          taskId: input.taskId,
          projectId: executionRecord.task.projectId,
          source: "harbor",
          nextSequence,
          events: [
            createSyntheticCancelledEvent({
              reason: `${reason} (forced convergence without runtime handle)`,
              createdAt: finishedAt,
              forced: true,
            }),
          ],
        })
        return
      }

      handle.cancelRequestedAt = requestedAt
      handle.abortController.abort(reason)
      await handle.completion
    },
  }
}
