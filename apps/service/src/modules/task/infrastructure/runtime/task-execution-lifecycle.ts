import type { PrismaClient } from "@prisma/client"

import {
  type AgentInput,
  AgentFactory,
  type AgentType,
  type IAgentRuntime,
} from "../../../../lib/agents"
import type { TaskNotificationPublisher } from "../../application/task-notification"
import type { TaskRepository } from "../../application/task-repository"
import type { TaskRuntimeConfig } from "../../application/task-runtime-port"
import {
  createSyntheticCancelledEvent,
  createSyntheticCancelRequestedEvent,
  createSyntheticErrorEvent,
  createSyntheticUserInputEvent,
  normalizeAgentType,
} from "./normalize-agent-events"
import { createTaskExecutionDriver } from "./task-execution-driver"
import { createTaskExecutionHandleRegistry } from "./task-execution-handle-registry"
import { createTaskExecutionStateStore } from "./task-execution-state"

function now() {
  return new Date()
}

function buildOrphanedExecutionMessage(input: {
  status: string
  hasSessionId: boolean
}) {
  const resumableSuffix = input.hasSessionId
    ? " The recorded session can be resumed on the same execution."
    : " No resumable session was recorded."

  if (input.status === "queued") {
    return (
      "Execution did not start because Harbor service restarted before the queued run began." +
      resumableSuffix
    )
  }

  return (
    "Execution was interrupted because Harbor service restarted while the run was in progress." +
    resumableSuffix
  )
}

export function createTaskExecutionLifecycle(args: {
  prisma: PrismaClient
  taskRepository: Pick<TaskRepository, "findById">
  notificationPublisher: TaskNotificationPublisher
  harborApiBaseUrl?: string
  logger?: Pick<Console, "error" | "warn">
  resolveAgentRuntime?: (type: AgentType) => IAgentRuntime
}) {
  const resolveAgentRuntime =
    args.resolveAgentRuntime ?? ((type: AgentType) => AgentFactory.getRuntime(type))
  const executionHandleRegistry = createTaskExecutionHandleRegistry()
  const stateStore = createTaskExecutionStateStore({
    prisma: args.prisma,
    taskRepository: args.taskRepository,
    notificationPublisher: args.notificationPublisher,
  })
  const executionDriver = createTaskExecutionDriver({
    prisma: args.prisma,
    stateStore,
    executionHandleRegistry,
    harborApiBaseUrl: args.harborApiBaseUrl,
    logger: args.logger,
  })

  async function loadExecutionForTask(taskId: string) {
    const executionRecord = await args.prisma.execution.findUnique({
      where: {
        ownerId: taskId,
      },
      select: {
        id: true,
        ownerId: true,
        executorType: true,
        executorModel: true,
        executionMode: true,
        executorEffort: true,
        workingDirectory: true,
        sessionId: true,
      },
    })

    if (!executionRecord) {
      throw new Error(`Execution for task ${taskId} was not found.`)
    }

    return executionRecord
  }

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

  async function markExecutionRunning(input: {
    executionId: string
    taskId: string
    projectPath: string
    runtimeConfig: TaskRuntimeConfig
    startedAt: Date
    sessionId?: string | null
    command?: string
  }) {
    await args.prisma.execution.update({
      where: {
        id: input.executionId,
      },
      data: {
        workingDirectory: input.projectPath,
        executorType: input.runtimeConfig.executor,
        executorModel: input.runtimeConfig.model,
        executionMode: input.runtimeConfig.executionMode,
        executorEffort: input.runtimeConfig.effort,
        status: "running",
        startedAt: input.startedAt,
        finishedAt: null,
        exitCode: null,
        errorMessage: null,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        ...(input.command ? { command: input.command } : {}),
      },
    })

    await stateStore.markTaskRunning(input.taskId, input.startedAt)
  }

  async function failBootstrap(input: {
    executionId: string
    taskId: string
    projectId: string
    sessionId: string | null
    error: unknown
  }) {
    const message = input.error instanceof Error ? input.error.message : String(input.error)
    const finishedAt = now()

    try {
      await stateStore.appendEvents({
        executionId: input.executionId,
        taskId: input.taskId,
        projectId: input.projectId,
        source: "harbor",
        nextSequence: await stateStore.getNextSequence(input.executionId),
        events: [createSyntheticErrorEvent({ message, createdAt: finishedAt })],
      })
    } catch (appendError) {
      args.logger?.warn?.(
        {
          taskId: input.taskId,
          executionId: input.executionId,
          error: appendError,
        },
        "Failed to append synthetic task bootstrap failure event",
      )
    }

    await stateStore.markFailed({
      executionId: input.executionId,
      taskId: input.taskId,
      finishedAt,
      sessionId: input.sessionId,
      message,
      expectedExecutionStatuses: ["queued", "running"],
      expectedTaskStatuses: ["queued", "running"],
    })
  }

  async function resolveResumableRuntime(input: {
    taskId: string
    executorType: string | null
    expectedExecutor: string
    sessionId: string | null
  }) {
    if (!input.sessionId) {
      throw new Error(`Execution for task ${input.taskId} has no resumable session.`)
    }

    if (input.executorType !== input.expectedExecutor) {
      throw new Error(
        `Execution for task ${input.taskId} cannot resume with executor "${input.expectedExecutor}".`,
      )
    }

    const agentType = normalizeAgentType(input.expectedExecutor)
    const capability = await AgentFactory.getCapability(agentType).inspect()
    if (!capability.supportsResume) {
      throw new Error(`${input.expectedExecutor} does not support resume.`)
    }

    return {
      agentType,
      agentRuntime: resolveAgentRuntime(agentType),
      sessionId: input.sessionId,
    }
  }

  return {
    async startTaskExecution(input: {
      taskId: string
      projectId: string
      projectPath: string
      input: AgentInput
      runtimeConfig: TaskRuntimeConfig
    }) {
      const executionRecord = await loadExecutionForTask(input.taskId)

      await persistUserInputEvent({
        executionId: executionRecord.id,
        taskId: input.taskId,
        projectId: input.projectId,
        agentInput: input.input,
      })

      try {
        const agentType = normalizeAgentType(input.runtimeConfig.executor)
        const agentRuntime = resolveAgentRuntime(agentType)
        const startedAt = now()

        await markExecutionRunning({
          executionId: executionRecord.id,
          taskId: input.taskId,
          projectPath: input.projectPath,
          runtimeConfig: input.runtimeConfig,
          startedAt,
          command: "agent.startSession",
        })

        executionDriver.launchExecution({
          ...input,
          executionId: executionRecord.id,
          executionRecord: {
            ...executionRecord,
            workingDirectory: input.projectPath,
          },
          startedAt,
          startMode: "start",
          agentType,
          agentRuntime,
        })
      } catch (error) {
        await failBootstrap({
          executionId: executionRecord.id,
          taskId: input.taskId,
          projectId: input.projectId,
          sessionId: executionRecord.sessionId,
          error,
        })

        throw error
      }
    },

    async resumeTaskExecution(input: {
      taskId: string
      projectId: string
      projectPath: string
      input: AgentInput
      runtimeConfig: TaskRuntimeConfig
    }) {
      const executionRecord = await loadExecutionForTask(input.taskId)

      const runtime = await resolveResumableRuntime({
        taskId: input.taskId,
        executorType: executionRecord.executorType,
        expectedExecutor: input.runtimeConfig.executor,
        sessionId: executionRecord.sessionId,
      })

      await persistUserInputEvent({
        executionId: executionRecord.id,
        taskId: input.taskId,
        projectId: input.projectId,
        agentInput: input.input,
      })

      try {
        const startedAt = now()

        await markExecutionRunning({
          executionId: executionRecord.id,
          taskId: input.taskId,
          projectPath: input.projectPath,
          runtimeConfig: input.runtimeConfig,
          startedAt,
          sessionId: runtime.sessionId,
        })

        executionDriver.launchExecution({
          ...input,
          executionId: executionRecord.id,
          executionRecord: {
            ...executionRecord,
            workingDirectory: input.projectPath,
            sessionId: runtime.sessionId,
          },
          startedAt,
          startMode: "resume",
          agentType: runtime.agentType,
          agentRuntime: runtime.agentRuntime,
        })
      } catch (error) {
        await failBootstrap({
          executionId: executionRecord.id,
          taskId: input.taskId,
          projectId: input.projectId,
          sessionId: runtime.sessionId,
          error,
        })

        throw error
      }
    },

    async cancelTaskExecution(input: {
      taskId: string
      reason?: string | null
    }) {
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
      const requestedAt = now()
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
        const finishedAt = now()
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

    async reconcileOrphanedExecutions() {
      const executions = await args.prisma.execution.findMany({
        where: {
          ownerType: "task",
          status: {
            in: ["queued", "running"],
          },
        },
        select: {
          id: true,
          ownerId: true,
          status: true,
          sessionId: true,
          task: {
            select: {
              projectId: true,
            },
          },
        },
      })

      for (const execution of executions) {
        const finishedAt = now()
        const message = buildOrphanedExecutionMessage({
          status: execution.status,
          hasSessionId: Boolean(execution.sessionId),
        })

        try {
          try {
            await stateStore.appendEvents({
              executionId: execution.id,
              taskId: execution.ownerId,
              projectId: execution.task.projectId,
              source: "harbor",
              nextSequence: await stateStore.getNextSequence(execution.id),
              events: [createSyntheticErrorEvent({ message, createdAt: finishedAt })],
            })
          } catch (appendError) {
            args.logger?.warn?.(
              {
                taskId: execution.ownerId,
                executionId: execution.id,
                error: appendError,
              },
              "Failed to append synthetic restart recovery event",
            )
          }

          await stateStore.markFailed({
            executionId: execution.id,
            taskId: execution.ownerId,
            finishedAt,
            sessionId: execution.sessionId,
            message,
            expectedExecutionStatuses: ["queued", "running"],
            expectedTaskStatuses: ["queued", "running"],
          })

          args.logger?.warn?.(
            {
              taskId: execution.ownerId,
              executionId: execution.id,
              previousStatus: execution.status,
            },
            "Reconciled orphaned task execution after service restart",
          )
        } catch (error) {
          args.logger?.error?.(
            {
              taskId: execution.ownerId,
              executionId: execution.id,
              error,
            },
            "Failed to reconcile orphaned task execution",
          )
        }
      }

      return executions.length
    },
  }
}
