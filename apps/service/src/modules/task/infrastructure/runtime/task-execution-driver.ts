import { Prisma, type PrismaClient } from "@prisma/client"

import type { AgentType, IAgentRuntime } from "../../../../lib/agents"
import type { TaskNotificationPublisher } from "../../application/task-notification"
import { toTaskListItem } from "../../application/task-read-models"
import type { TaskRepository } from "../../application/task-repository"
import type { TaskRuntimeConfig } from "../../application/task-runtime-port"
import {
  applyNormalizedTaskEvents,
  createSyntheticErrorEvent,
  createSyntheticUserPromptEvent,
  createTaskRunEventState,
  normalizeRawAgentEvent,
  type NormalizedTaskEvent,
} from "./normalize-agent-events"
import { createAgentRuntimeOptions } from "./runtime-policy"

function now() {
  return new Date()
}

export function createTaskExecutionDriver(args: {
  prisma: PrismaClient
  taskRepository: Pick<TaskRepository, "findById">
  notificationPublisher: TaskNotificationPublisher
  harborApiBaseUrl?: string
  logger?: Pick<Console, "error" | "warn">
}) {
  async function publishTaskUpsert(taskId: string) {
    const task = await args.taskRepository.findById(taskId)
    if (!task) {
      return
    }

    await args.notificationPublisher.publish({
      type: "task_upserted",
      projectId: task.projectId,
      task: toTaskListItem(task),
    })
  }

  async function publishNormalizedEvent(input: {
    executionId: string
    taskId: string
    projectId: string
    sequence: number
    source: string
    event: NormalizedTaskEvent
  }) {
    const row = await args.prisma.executionEvent.create({
      data: {
        executionId: input.executionId,
        sequence: input.sequence,
        source: input.source,
        rawEventType: input.event.eventType,
        rawPayload: input.event.payload as Prisma.InputJsonValue,
        createdAt: input.event.createdAt,
      },
    })

    await args.notificationPublisher.publish({
      type: "task_event_appended",
      projectId: input.projectId,
      taskId: input.taskId,
      event: {
        id: row.id,
        taskId: input.taskId,
        sequence: row.sequence,
        eventType: row.rawEventType,
        payload: row.rawPayload as Record<string, unknown>,
        createdAt: row.createdAt,
      },
    })
  }

  async function appendEvents(input: {
    executionId: string
    taskId: string
    projectId: string
    source: string
    nextSequence: number
    events: NormalizedTaskEvent[]
  }) {
    let nextSequence = input.nextSequence
    for (const event of input.events) {
      await publishNormalizedEvent({
        executionId: input.executionId,
        taskId: input.taskId,
        projectId: input.projectId,
        sequence: nextSequence,
        source: input.source,
        event,
      })
      nextSequence += 1
    }

    return nextSequence
  }

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
        workingDirectory: true,
        sessionId: true,
      },
    })

    if (!executionRecord) {
      throw new Error(`Execution for task ${taskId} was not found before runtime start.`)
    }

    return executionRecord
  }

  async function markTaskRunning(taskId: string, startedAt: Date) {
    await args.prisma.task.update({
      where: {
        id: taskId,
      },
      data: {
        status: "running",
        startedAt,
        finishedAt: null,
      },
    })
    await publishTaskUpsert(taskId)
  }

  async function markExecutionRunning(input: {
    executionId: string
    startedAt: Date
    command: string
  }) {
    await args.prisma.execution.update({
      where: {
        id: input.executionId,
      },
      data: {
        status: "running",
        startedAt: input.startedAt,
        finishedAt: null,
        exitCode: null,
        errorMessage: null,
        command: input.command,
      },
    })
  }

  async function markTaskCompleted(input: {
    taskId: string
    finishedAt: Date
  }) {
    await args.prisma.task.update({
      where: {
        id: input.taskId,
      },
      data: {
        status: "completed",
        finishedAt: input.finishedAt,
      },
    })
    await publishTaskUpsert(input.taskId)
  }

  async function markExecutionCompleted(input: {
    executionId: string
    finishedAt: Date
    sessionId: string | null
    exitCode: number
  }) {
    await args.prisma.execution.update({
      where: {
        id: input.executionId,
      },
      data: {
        status: "completed",
        finishedAt: input.finishedAt,
        exitCode: input.exitCode,
        errorMessage: null,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      },
    })
  }

  async function markTaskFailed(input: {
    taskId: string
    finishedAt: Date
  }) {
    await args.prisma.task.update({
      where: {
        id: input.taskId,
      },
      data: {
        status: "failed",
        finishedAt: input.finishedAt,
      },
    })
    await publishTaskUpsert(input.taskId)
  }

  async function markExecutionFailed(input: {
    executionId: string
    finishedAt: Date
    sessionId: string | null
    message: string
  }) {
    await args.prisma.execution.update({
      where: {
        id: input.executionId,
      },
      data: {
        status: "failed",
        finishedAt: input.finishedAt,
        exitCode: null,
        errorMessage: input.message,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      },
    })
  }

  async function runInBackground(input: {
    executionId: string
    taskId: string
    projectId: string
    prompt: string
    runtimeConfig: TaskRuntimeConfig
    agentType: AgentType
    agentRuntime: IAgentRuntime
    executionRecord: Awaited<ReturnType<typeof loadExecutionRecord>>
    startedAt: Date
  }) {
    const state = createTaskRunEventState()
    let nextSequence =
      (await args.prisma.executionEvent.aggregate({
        where: {
          executionId: input.executionId,
        },
        _max: {
          sequence: true,
        },
      }))._max.sequence ?? 0
    nextSequence += 1

    try {
      const promptEvent = createSyntheticUserPromptEvent({
        content: input.prompt,
        createdAt: input.startedAt,
      })
      if (promptEvent) {
        nextSequence = await appendEvents({
          executionId: input.executionId,
          taskId: input.taskId,
          projectId: input.projectId,
          source: "harbor",
          nextSequence,
          events: [promptEvent],
        })
      }

      const events = input.agentRuntime.startSessionAndRun(
        createAgentRuntimeOptions({
          workingDirectory: input.executionRecord.workingDirectory,
          modelId: input.runtimeConfig.model,
          executionMode: input.runtimeConfig.executionMode,
          env: buildHarborSessionEnv(input),
        }),
        input.prompt,
      )

      for await (const envelope of events) {
        const normalizedEvents = normalizeRawAgentEvent({
          envelope,
          state,
        })
        if (normalizedEvents.length === 0) {
          continue
        }

        nextSequence = await appendEvents({
          executionId: input.executionId,
          taskId: input.taskId,
          projectId: input.projectId,
          source: input.agentType,
          nextSequence,
          events: normalizedEvents,
        })

        const nextState = applyNormalizedTaskEvents(state, normalizedEvents)
        state.sessionId = nextState.sessionId
        state.stdout = nextState.stdout
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
      await markExecutionCompleted({
        executionId: input.executionId,
        finishedAt,
        sessionId: state.sessionId,
        exitCode: 0,
      })
      await markTaskCompleted({
        taskId: input.taskId,
        finishedAt,
      })
    } catch (error) {
      args.logger?.error?.(
        {
          taskId: input.taskId,
          error,
        },
        "Task execution failed",
      )

      const message = error instanceof Error ? error.message : String(error)
      if (!state.hasTerminalErrorEvent) {
        await appendEvents({
          executionId: input.executionId,
          taskId: input.taskId,
          projectId: input.projectId,
          source: "harbor",
          nextSequence,
          events: [createSyntheticErrorEvent({ message })],
        })
      }

      const finishedAt = now()
      await markExecutionFailed({
        executionId: input.executionId,
        finishedAt,
        sessionId: state.sessionId,
        message,
      })
      await markTaskFailed({
        taskId: input.taskId,
        finishedAt,
      })
    }
  }

  return {
    async startExecution(input: {
      taskId: string
      projectId: string
      projectPath: string
      prompt: string
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
        },
      })
      await markExecutionRunning({
        executionId: executionRecord.id,
        startedAt,
        command: "agent.startSession",
      })
      await markTaskRunning(input.taskId, startedAt)

      void runInBackground({
        ...input,
        executionId: executionRecord.id,
        executionRecord,
        startedAt,
      })
    },
  }
}
