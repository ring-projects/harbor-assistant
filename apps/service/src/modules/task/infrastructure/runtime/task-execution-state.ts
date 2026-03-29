import {
  Prisma,
  type ExecutionStatus,
  type PrismaClient,
  type TaskStatus,
} from "@prisma/client"

import type { TaskNotificationPublisher } from "../../application/task-notification"
import { toTaskListItem } from "../../application/task-read-models"
import type { TaskRepository } from "../../application/task-repository"
import type { NormalizedTaskEvent } from "./normalize-agent-events"

export function createTaskExecutionStateStore(args: {
  prisma: PrismaClient
  taskRepository: Pick<TaskRepository, "findById">
  notificationPublisher: TaskNotificationPublisher
}) {
  class TerminalTransitionConflictError extends Error {}

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

  async function getNextSequence(executionId: string) {
    const currentMaxSequence =
      (await args.prisma.executionEvent.aggregate({
        where: {
          executionId,
        },
        _max: {
          sequence: true,
        },
      }))._max.sequence ?? 0

    return currentMaxSequence + 1
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
      while (true) {
        try {
          await publishNormalizedEvent({
            executionId: input.executionId,
            taskId: input.taskId,
            projectId: input.projectId,
            sequence: nextSequence,
            source: input.source,
            event,
          })
          break
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            nextSequence = await getNextSequence(input.executionId)
            continue
          }

          throw error
        }
      }

      nextSequence += 1
    }

    return nextSequence
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

  async function transitionTerminalState(input: {
    executionId: string
    taskId: string
    executionData: Prisma.ExecutionUpdateManyMutationInput
    taskData: Prisma.TaskUpdateManyMutationInput
    expectedExecutionStatuses?: ExecutionStatus[]
    expectedTaskStatuses?: TaskStatus[]
  }) {
    try {
      const updated = await args.prisma.$transaction(async (tx) => {
        const executionResult = await tx.execution.updateMany({
          where: {
            id: input.executionId,
            status: {
              in: input.expectedExecutionStatuses ?? ["running"],
            },
          },
          data: input.executionData,
        })

        if (executionResult.count === 0) {
          return false
        }

        const taskResult = await tx.task.updateMany({
          where: {
            id: input.taskId,
            status: {
              in: input.expectedTaskStatuses ?? ["running"],
            },
          },
          data: input.taskData,
        })

        if (taskResult.count === 0) {
          throw new TerminalTransitionConflictError()
        }

        return true
      })

      return updated
    } catch (error) {
      if (error instanceof TerminalTransitionConflictError) {
        return false
      }

      throw error
    }
  }

  async function markCompleted(input: {
    executionId: string
    taskId: string
    finishedAt: Date
    sessionId: string | null
    exitCode: number
    expectedExecutionStatuses?: ExecutionStatus[]
    expectedTaskStatuses?: TaskStatus[]
  }) {
    const updated = await transitionTerminalState({
      executionId: input.executionId,
      taskId: input.taskId,
      executionData: {
        status: "completed",
        finishedAt: input.finishedAt,
        exitCode: input.exitCode,
        errorMessage: null,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      },
      taskData: {
        status: "completed",
        finishedAt: input.finishedAt,
      },
      expectedExecutionStatuses: input.expectedExecutionStatuses,
      expectedTaskStatuses: input.expectedTaskStatuses,
    })

    if (!updated) {
      return false
    }

    await publishTaskUpsert(input.taskId)
    return true
  }

  async function markFailed(input: {
    executionId: string
    taskId: string
    finishedAt: Date
    sessionId: string | null
    message: string
    expectedExecutionStatuses?: ExecutionStatus[]
    expectedTaskStatuses?: TaskStatus[]
  }) {
    const updated = await transitionTerminalState({
      executionId: input.executionId,
      taskId: input.taskId,
      executionData: {
        status: "failed",
        finishedAt: input.finishedAt,
        exitCode: null,
        errorMessage: input.message,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      },
      taskData: {
        status: "failed",
        finishedAt: input.finishedAt,
      },
      expectedExecutionStatuses: input.expectedExecutionStatuses,
      expectedTaskStatuses: input.expectedTaskStatuses,
    })

    if (!updated) {
      return false
    }

    await publishTaskUpsert(input.taskId)
    return true
  }

  async function markCancelled(input: {
    executionId: string
    taskId: string
    finishedAt: Date
    sessionId: string | null
    expectedExecutionStatuses?: ExecutionStatus[]
    expectedTaskStatuses?: TaskStatus[]
  }) {
    const updated = await transitionTerminalState({
      executionId: input.executionId,
      taskId: input.taskId,
      executionData: {
        status: "cancelled",
        finishedAt: input.finishedAt,
        exitCode: null,
        errorMessage: null,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      },
      taskData: {
        status: "cancelled",
        finishedAt: input.finishedAt,
      },
      expectedExecutionStatuses: input.expectedExecutionStatuses,
      expectedTaskStatuses: input.expectedTaskStatuses,
    })

    if (!updated) {
      return false
    }

    await publishTaskUpsert(input.taskId)
    return true
  }

  return {
    appendEvents,
    getNextSequence,
    markCancelled,
    markCompleted,
    markExecutionRunning,
    markFailed,
    markTaskRunning,
    publishTaskUpsert,
  }
}
