import type { PrismaClient } from "@prisma/client"

import type {
  AgentInput,
  AgentType,
  IAgentRuntime,
} from "../../../../lib/agents"
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
import type { createTaskExecutionStateStore } from "./task-execution-state"

function now() {
  return new Date()
}

type TaskExecutionRecord = {
  id: string
  ownerId: string
  executorType: string | null
  executorModel: string | null
  executionMode: string | null
  executorEffort: string | null
  workingDirectory: string
  sessionId: string | null
}

export function createTaskExecutionDriver(args: {
  prisma: PrismaClient
  stateStore: ReturnType<typeof createTaskExecutionStateStore>
  executionHandleRegistry: {
    register(taskId: string, handle: TaskExecutionHandle): void
    delete(taskId: string, handle?: TaskExecutionHandle): void
  }
  harborApiBaseUrl?: string
  logger?: Pick<Console, "error" | "warn">
}) {
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

  async function runInBackground(input: {
    executionId: string
    taskId: string
    projectId: string
    input: AgentInput
    runtimeConfig: TaskRuntimeConfig
    agentType: AgentType
    agentRuntime: IAgentRuntime
    executionRecord: TaskExecutionRecord
    startedAt: Date
    startMode: "start" | "resume"
    signal: AbortSignal
  }) {
    const state = createTaskRunEventState()
    let nextSequence = await args.stateStore.getNextSequence(input.executionId)

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

        nextSequence = await args.stateStore.appendEvents({
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
      await args.stateStore.markCompleted({
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

        const cancelled = await args.stateStore.markCancelled({
          executionId: input.executionId,
          taskId: input.taskId,
          finishedAt,
          sessionId: state.sessionId ?? input.executionRecord.sessionId,
        })

        if (!cancelled) {
          return
        }

        await args.stateStore.appendEvents({
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
        await args.stateStore.appendEvents({
          executionId: input.executionId,
          taskId: input.taskId,
          projectId: input.projectId,
          source: "harbor",
          nextSequence,
          events: [createSyntheticErrorEvent({ message })],
        })
      }

      const finishedAt = now()
      await args.stateStore.markFailed({
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
    input: AgentInput
    runtimeConfig: TaskRuntimeConfig
    agentType: AgentType
    agentRuntime: IAgentRuntime
    executionId: string
    executionRecord: TaskExecutionRecord
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
    launchExecution(input: {
      taskId: string
      projectId: string
      input: AgentInput
      runtimeConfig: TaskRuntimeConfig
      agentType: AgentType
      agentRuntime: IAgentRuntime
      executionId: string
      executionRecord: TaskExecutionRecord
      startedAt: Date
      startMode: "start" | "resume"
    }) {
      launchExecution(input)
    },
  }
}
