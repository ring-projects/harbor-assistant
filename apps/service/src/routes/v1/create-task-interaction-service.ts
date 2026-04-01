import { isTerminalTaskStatus } from "../../modules/task/domain/task"
import { getTaskDetailUseCase } from "../../modules/task/application/get-task-detail"
import { getTaskEventsUseCase } from "../../modules/task/application/get-task-events"
import type {
  TaskDetail,
  TaskEventItem,
  TaskListItem,
} from "../../modules/task/application/task-read-models"
import type { TaskEventProjection } from "../../modules/task/application/task-event-projection"
import type {
  TaskNotification,
  TaskNotificationSubscriber,
} from "../../modules/task/application/task-notification"
import type { TaskRepository } from "../../modules/task/application/task-repository"
import { toTaskAppError } from "../../modules/task/task-app-error"
import type {
  InteractionTaskEventItem,
  InteractionTaskRecord,
  InteractionTaskStreamEvent,
  TaskInteractionQueries,
  TaskInteractionStream,
  TaskInteractionSubscription,
} from "../../modules/interaction/application/ports"

function toIsoStringOrNull(value: Date | null) {
  return value ? value.toISOString() : null
}

function toInteractionTaskRecord(
  task: TaskDetail | TaskListItem,
): InteractionTaskRecord {
  return {
    id: task.id,
    projectId: task.projectId,
    ...("prompt" in task ? { prompt: task.prompt } : {}),
    title: task.title,
    titleSource: task.titleSource,
    executor: task.executor,
    model: task.model,
    executionMode: task.executionMode,
    effort: task.effort,
    status: task.status,
    archivedAt: toIsoStringOrNull(task.archivedAt),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    startedAt: toIsoStringOrNull(task.startedAt),
    finishedAt: toIsoStringOrNull(task.finishedAt),
  }
}

function toInteractionTaskEventItem(event: TaskEventItem): InteractionTaskEventItem {
  return {
    id: event.id,
    taskId: event.taskId,
    sequence: event.sequence,
    eventType: event.eventType,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  }
}

function toTaskStreamEvents(
  notification: TaskNotification,
): InteractionTaskStreamEvent[] {
  switch (notification.type) {
    case "task_upserted": {
      const events: InteractionTaskStreamEvent[] = [
        {
          type: "task_upsert",
          projectId: notification.projectId,
          task: toInteractionTaskRecord(notification.task),
        },
        {
          type: "task_status",
          taskId: notification.task.id,
          status: notification.task.status,
        },
      ]

      if (isTerminalTaskStatus(notification.task.status)) {
        events.push({
          type: "task_end",
          taskId: notification.task.id,
          status: notification.task.status,
          cursor: 0,
        })
      }

      return events
    }
    case "task_deleted":
      return [
        {
          type: "task_deleted",
          projectId: notification.projectId,
          taskId: notification.taskId,
        },
      ]
    case "task_event_appended":
      return [
        {
          type: "agent_event",
          taskId: notification.taskId,
          event: toInteractionTaskEventItem(notification.event),
        },
      ]
  }
}

function createSubscription(
  subscribe: (listener: (event: InteractionTaskStreamEvent) => void) => () => void,
): TaskInteractionSubscription {
  return {
    subscribe(listener) {
      const unsubscribe = subscribe(listener)
      return {
        async unsubscribe() {
          unsubscribe()
        },
      }
    },
  }
}

export function createTaskInteractionService(args: {
  repository: Pick<TaskRepository, "findById">
  eventProjection: TaskEventProjection
  notificationSubscriber: TaskNotificationSubscriber
}): {
  queries: TaskInteractionQueries
  stream: TaskInteractionStream
} {
  const queries: TaskInteractionQueries = {
    async getTaskDetail(taskId) {
      try {
        const task = await getTaskDetailUseCase(args.repository, taskId)
        return toInteractionTaskRecord(task)
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
    async getTaskEvents(input) {
      try {
        const result = await getTaskEventsUseCase(
          args.repository,
          args.eventProjection,
          input,
        )

        return {
          task: toInteractionTaskRecord(result.task),
          events: {
            taskId: result.events.taskId,
            items: result.events.items.map(toInteractionTaskEventItem),
            nextSequence: result.events.nextSequence,
          },
          isTerminal: result.isTerminal,
        }
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
  }

  const stream: TaskInteractionStream = {
    selectTask(taskId) {
      const normalizedTaskId = taskId.trim()

      return createSubscription((listener) => {
        if (!normalizedTaskId) {
          return () => {}
        }

        return args.notificationSubscriber.subscribe({
          taskId: normalizedTaskId,
          listener(notification) {
            for (const event of toTaskStreamEvents(notification)) {
              listener(event)
            }
          },
        })
      })
    },
  }

  return {
    queries,
    stream,
  }
}
