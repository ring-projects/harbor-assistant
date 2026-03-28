import { Prisma, type PrismaClient } from "@prisma/client"

import type { TaskNotificationPublisher } from "../../application/task-notification"
import { toTaskListItem } from "../../application/task-read-models"
import type { TaskRepository } from "../../application/task-repository"
import type { NormalizedTaskEvent } from "./normalize-agent-events"

export function createTaskExecutionStateStore(args: {
  prisma: PrismaClient
  taskRepository: Pick<TaskRepository, "findById">
  notificationPublisher: TaskNotificationPublisher
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

  async function markCompleted(input: {
    executionId: string
    taskId: string
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

  async function markFailed(input: {
    executionId: string
    taskId: string
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

  return {
    appendEvents,
    getNextSequence,
    markCompleted,
    markExecutionRunning,
    markFailed,
    markTaskRunning,
    publishTaskUpsert,
  }
}
