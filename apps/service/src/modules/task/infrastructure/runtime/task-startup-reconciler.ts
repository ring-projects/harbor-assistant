import { type ExecutionStatus, type PrismaClient } from "@prisma/client"

import type { TaskNotificationPublisher } from "../../application/task-notification"
import type { TaskRepository } from "../../application/task-repository"
import { createSyntheticErrorEvent } from "./normalize-agent-events"
import { createTaskExecutionStateStore } from "./task-execution-state"

function now() {
  return new Date()
}

function buildOrphanedExecutionMessage(input: {
  status: ExecutionStatus
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

export function createTaskStartupReconciler(args: {
  prisma: PrismaClient
  taskRepository: Pick<TaskRepository, "findById">
  notificationPublisher: TaskNotificationPublisher
  logger?: Pick<Console, "error" | "warn">
}) {
  const stateStore = createTaskExecutionStateStore({
    prisma: args.prisma,
    taskRepository: args.taskRepository,
    notificationPublisher: args.notificationPublisher,
  })

  return {
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
