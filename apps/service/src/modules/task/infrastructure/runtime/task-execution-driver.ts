import type { PrismaClient } from "@prisma/client"

import type {
  AgentInput,
  AgentType,
  IAgentRuntime,
} from "../../../../lib/agents"
import type { TaskNotificationPublisher } from "../../application/task-notification"
import type { TaskRepository } from "../../application/task-repository"
import type { TaskRuntimeConfig } from "../../application/task-runtime-port"
import {
  applyNormalizedTaskEvents,
  createSyntheticCancelledEvent,
  createSyntheticErrorEvent,
  createTaskRunEventState,
  normalizeRawAgentEvent,
} from "./normalize-agent-events"
import { createAgentRuntimeOptions } from "./runtime-policy"
import type { TaskExecutionHandle } from "./task-execution-handle-registry"
import { createTaskExecutionStateStore } from "./task-execution-state"

function now() {
  return new Date()
}

export function createTaskExecutionDriver(args: {
  prisma: PrismaClient
  taskRepository: Pick<TaskRepository, "findById">
  notificationPublisher: TaskNotificationPublisher
  executionHandleRegistry: {
    register(taskId: string, handle: TaskExecutionHandle): void
    delete(taskId: string, handle?: TaskExecutionHandle): void
  }
  harborApiBaseUrl?: string
  logger?: Pick<Console, "error" | "warn">
}) {
  const stateStore = createTaskExecutionStateStore({
    prisma: args.prisma,
    taskRepository: args.taskRepository,
    notificationPublisher: args.notificationPublisher,
  })

  function buildHarborSessionEnv(input: {
    projectId: string
    taskId: string
  }) {
    if (!args.harborApiBaseUrl) {
      return undefined
    }

    return {
      HARBOR_SERVICE_BASE_URL: args.harborApiBaseUrl,
      HARBOR_PROJECT_ID: input.projectId,
      HARBOR_TASK_ID: input.taskId,
    }
  }

  async function loadExecutionRecord(taskId: string) {
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
      throw new Error(`Execution for task ${taskId} was not found before runtime start.`)
    }

    return executionRecord
  }

  async function runInBackground(input: {
    executionId: string
    taskId: string
    projectId: string
    input: AgentInput
    runtimeConfig: TaskRuntimeConfig
    agentType: AgentType
    agentRuntime: IAgentRuntime
    executionRecord: Awaited<ReturnType<typeof loadExecutionRecord>>
    startedAt: Date
    startMode: "start" | "resume"
    signal: AbortSignal
  }) {
    const state = createTaskRunEventState()
    let nextSequence = await stateStore.getNextSequence(input.executionId)

    try {
      const runtimeOptions = createAgentRuntimeOptions({
        workingDirectory: input.executionRecord.workingDirectory,
        modelId: input.runtimeConfig.model,
        executionMode: input.runtimeConfig.executionMode,
        effort: input.runtimeConfig.effort,
        env: buildHarborSessionEnv(input),
      })
      const events =
        input.startMode === "resume"
          ? input.agentRuntime.resumeSessionAndRun(
              input.executionRecord.sessionId ?? "",
              runtimeOptions,
              input.input,
              input.signal,
            )
          : input.agentRuntime.startSessionAndRun(
              runtimeOptions,
              input.input,
              input.signal,
            )

      for await (const envelope of events) {
        const normalizedEvents = normalizeRawAgentEvent({
          envelope,
          state,
        })
        if (normalizedEvents.length === 0) {
          continue
        }

        nextSequence = await stateStore.appendEvents({
          executionId: input.executionId,
          taskId: input.taskId,
          projectId: input.projectId,
          source: input.agentType,
          nextSequence,
          events: normalizedEvents,
        })

        const nextState = applyNormalizedTaskEvents(state, normalizedEvents)
        state.sessionId = nextState.sessionId
        state.terminalError = nextState.terminalError
        state.hasTerminalErrorEvent = nextState.hasTerminalErrorEvent

        if (nextState.sessionId && nextState.sessionId !== input.executionRecord.sessionId) {
          input.executionRecord.sessionId = nextState.sessionId
          await args.prisma.execution.update({
            where: {
              id: input.executionId,
            },
            data: {
              sessionId: nextState.sessionId,
            },
          })
        }
      }

      if (state.terminalError) {
        throw new Error(state.terminalError)
      }

      const finishedAt = now()
      await stateStore.markCompleted({
        executionId: input.executionId,
        taskId: input.taskId,
        finishedAt,
        sessionId: state.sessionId,
        exitCode: 0,
      })
    } catch (error) {
      if (input.signal.aborted) {
        const finishedAt = now()
        const reason =
          typeof input.signal.reason === "string" && input.signal.reason.trim()
            ? input.signal.reason.trim()
            : "User requested stop"

        const cancelled = await stateStore.markCancelled({
          executionId: input.executionId,
          taskId: input.taskId,
          finishedAt,
          sessionId: state.sessionId ?? input.executionRecord.sessionId,
        })

        if (!cancelled) {
          return
        }

        await stateStore.appendEvents({
          executionId: input.executionId,
          taskId: input.taskId,
          projectId: input.projectId,
          source: "harbor",
          nextSequence,
          events: [
            createSyntheticCancelledEvent({
              reason,
              createdAt: finishedAt,
            }),
          ],
        })
        return
      }

      args.logger?.error?.(
        {
          taskId: input.taskId,
          error,
        },
        "Task execution failed",
      )

      const message = error instanceof Error ? error.message : String(error)
      if (!state.hasTerminalErrorEvent) {
        await stateStore.appendEvents({
          executionId: input.executionId,
          taskId: input.taskId,
          projectId: input.projectId,
          source: "harbor",
          nextSequence,
          events: [createSyntheticErrorEvent({ message })],
        })
      }

      const finishedAt = now()
      await stateStore.markFailed({
        executionId: input.executionId,
        taskId: input.taskId,
        finishedAt,
        sessionId: state.sessionId ?? input.executionRecord.sessionId,
        message,
      })
    }
  }

  function launchExecution(input: {
    taskId: string
    projectId: string
    projectPath: string
    input: AgentInput
    runtimeConfig: TaskRuntimeConfig
    agentType: AgentType
    agentRuntime: IAgentRuntime
    executionId: string
    executionRecord: Awaited<ReturnType<typeof loadExecutionRecord>>
    startedAt: Date
    startMode: "start" | "resume"
  }) {
    const abortController = new AbortController()
    const handle: TaskExecutionHandle = {
      abortController,
      completion: Promise.resolve(),
      cancelRequestedAt: null,
    }

    handle.completion = runInBackground({
      ...input,
      signal: abortController.signal,
    }).finally(() => {
      args.executionHandleRegistry.delete(input.taskId, handle)
    })

    args.executionHandleRegistry.register(input.taskId, handle)
    void handle.completion
  }

  return {
    async startExecution(input: {
      taskId: string
      projectId: string
      projectPath: string
      input: AgentInput
      runtimeConfig: TaskRuntimeConfig
      agentType: AgentType
      agentRuntime: IAgentRuntime
    }) {
      const executionRecord = await loadExecutionRecord(input.taskId)
      const startedAt = now()

      await args.prisma.execution.update({
        where: {
          id: executionRecord.id,
        },
        data: {
          workingDirectory: input.projectPath,
          executorType: input.runtimeConfig.executor,
          executorModel: input.runtimeConfig.model,
          executionMode: input.runtimeConfig.executionMode,
          executorEffort: input.runtimeConfig.effort,
        },
      })
      await stateStore.markExecutionRunning({
        executionId: executionRecord.id,
        startedAt,
        command: "agent.startSession",
      })
      await stateStore.markTaskRunning(input.taskId, startedAt)

      launchExecution({
        ...input,
        executionId: executionRecord.id,
        executionRecord,
        startedAt,
        startMode: "start",
      })
    },
    async resumeExecution(input: {
      taskId: string
      projectId: string
      projectPath: string
      input: AgentInput
      runtimeConfig: TaskRuntimeConfig
      sessionId: string
      agentType: AgentType
      agentRuntime: IAgentRuntime
    }) {
      const executionRecord = await loadExecutionRecord(input.taskId)
      const startedAt = now()

      await args.prisma.execution.update({
        where: {
          id: executionRecord.id,
        },
        data: {
          workingDirectory: input.projectPath,
          status: "running",
          startedAt,
          finishedAt: null,
          exitCode: null,
          errorMessage: null,
          sessionId: input.sessionId,
        },
      })
      await stateStore.markTaskRunning(input.taskId, startedAt)

      launchExecution({
        ...input,
        executionId: executionRecord.id,
        executionRecord: {
          ...executionRecord,
          workingDirectory: input.projectPath,
          sessionId: input.sessionId,
        },
        startedAt,
        startMode: "resume",
      })
    },
  }
}
