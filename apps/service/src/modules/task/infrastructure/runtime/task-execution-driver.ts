import type { PrismaClient } from "@prisma/client"

import type {
  AgentInput,
  AgentType,
  IAgentRuntime,
} from "../../../../lib/agents"
import type { AuthorizationAction } from "../../../authorization"
import type { PrismaAgentTokenStore } from "../../../auth"
import type { WorkspaceCodexSettings } from "../../../workspace/domain/workspace"
import type { TaskRuntimeConfig } from "../../application/task-runtime-port"
import {
  applyNormalizedTaskEvents,
  createSyntheticCancelledEvent,
  createSyntheticErrorEvent,
  createTaskRunEventState,
  normalizeRawAgentEvent,
} from "./normalize-agent-events"
import {
  prepareHarborAgentBridge,
  prependHarborAgentBridgeText,
} from "./harbor-agent-bridge"
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

function withProjectCodexEnv(input: {
  agentType: AgentType
  env: Record<string, string>
  codex?: WorkspaceCodexSettings
}) {
  if (input.agentType !== "codex") {
    return input.env
  }

  const nextEnv = { ...input.env }
  const baseUrl = input.codex?.baseUrl?.trim()
  const apiKey = input.codex?.apiKey?.trim()

  if (baseUrl) {
    nextEnv.OPENAI_BASE_URL = baseUrl
  }

  if (apiKey) {
    nextEnv.CODEX_API_KEY = apiKey
  }

  return nextEnv
}

export function createTaskExecutionDriver(args: {
  prisma: PrismaClient
  agentTokenStore?: PrismaAgentTokenStore
  stateStore: ReturnType<typeof createTaskExecutionStateStore>
  executionHandleRegistry: {
    register(taskId: string, handle: TaskExecutionHandle): void
    delete(taskId: string, handle?: TaskExecutionHandle): void
  }
  harborApiBaseUrl?: string
  publicSkillsRootDirectory?: string
  logger?: Pick<Console, "error" | "warn">
}) {
  const runtimeAgentScopes: AuthorizationAction[] = [
    "project.view",
    "project.files.read",
    "project.files.write",
    "project.git.read",
    "project.git.write",
    "project.git.subscribe",
    "project.tasks.read",
    "project.tasks.create",
    "task.view",
    "task.update",
    "task.cancel",
    "task.resume",
    "task.delete",
    "task.events.read",
    "task.subscribe",
    "orchestration.view",
    "orchestration.update",
    "orchestration.schedule.update",
    "orchestration.task.create",
  ]

  async function buildHarborRuntimeBridge(input: {
    projectId: string
    taskId: string
    workingDirectory: string
  }) {
    try {
      const task = await args.prisma.task.findUnique({
        where: {
          id: input.taskId,
        },
        select: {
          orchestrationId: true,
        },
      })

      const env: Record<string, string> = {
        HARBOR_PROJECT_ID: input.projectId,
        HARBOR_TASK_ID: input.taskId,
      }

      if (args.harborApiBaseUrl) {
        env.HARBOR_SERVICE_BASE_URL = args.harborApiBaseUrl
      }

      if (task?.orchestrationId) {
        env.HARBOR_ORCHESTRATION_ID = task.orchestrationId
      }

      if (args.agentTokenStore) {
        const created = await args.agentTokenStore.createToken({
          name: "runtime-task-token",
          projectId: input.projectId,
          orchestrationId: task?.orchestrationId ?? null,
          taskId: input.taskId,
          sourceTaskId: input.taskId,
          scopes: runtimeAgentScopes,
        })

        env.HARBOR_TOKEN = created.token
      }

      return prepareHarborAgentBridge({
        projectId: input.projectId,
        taskId: input.taskId,
        orchestrationId: task?.orchestrationId ?? null,
        workingDirectory: input.workingDirectory,
        baseEnv: env,
        publicSkillsRootDirectory: args.publicSkillsRootDirectory,
      })
    } catch (error) {
      args.logger?.warn?.(
        {
          taskId: input.taskId,
          error,
        },
        "Failed to prepare Harbor runtime bridge",
      )

      const fallbackEnv: Record<string, string> = {
        HARBOR_PROJECT_ID: input.projectId,
        HARBOR_TASK_ID: input.taskId,
      }
      if (args.harborApiBaseUrl) {
        fallbackEnv.HARBOR_SERVICE_BASE_URL = args.harborApiBaseUrl
      }

      return {
        env: fallbackEnv,
        preamble: "",
        mountedSkillsDirectory: null,
        mountedSkillNames: [],
      }
    }
  }

  async function runInBackground(input: {
    executionId: string
    taskId: string
    projectId: string
    input: AgentInput
    runtimeConfig: TaskRuntimeConfig
    projectCodex?: WorkspaceCodexSettings
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
      const harborBridge = await buildHarborRuntimeBridge({
        projectId: input.projectId,
        taskId: input.taskId,
        workingDirectory: input.executionRecord.workingDirectory,
      })
      const runtimeOptions = createAgentRuntimeOptions({
        workingDirectory: input.executionRecord.workingDirectory,
        modelId: input.runtimeConfig.model,
        executionMode: input.runtimeConfig.executionMode,
        effort: input.runtimeConfig.effort,
        env: withProjectCodexEnv({
          agentType: input.agentType,
          env: harborBridge.env,
          codex: input.projectCodex,
        }),
      })
      const runtimeInput = prependHarborAgentBridgeText(
        input.input,
        harborBridge.preamble,
      )
      const events =
        input.startMode === "resume"
          ? input.agentRuntime.resumeSessionAndRun(
              input.executionRecord.sessionId ?? "",
              runtimeOptions,
              runtimeInput,
              input.signal,
            )
          : input.agentRuntime.startSessionAndRun(
              runtimeOptions,
              runtimeInput,
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

        if (
          nextState.sessionId &&
          nextState.sessionId !== input.executionRecord.sessionId
        ) {
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
