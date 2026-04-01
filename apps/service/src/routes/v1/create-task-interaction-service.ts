import { getTaskUseCase } from "../../modules/task/application/get-task"
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
import { isTerminalTaskStatus } from "../../modules/task/domain/task"
import { toTaskAppError } from "../../modules/task/task-app-error"
import type {
  InteractionTaskEventItem,
  InteractionTaskEventsSnapshotMessage,
  InteractionTaskRecord,
  InteractionTaskSnapshotMessage,
  InteractionTaskStreamMessage,
  InteractionTaskTopic,
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
    orchestrationId: task.orchestrationId,
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

function toInteractionTaskEventItem(
  event: TaskEventItem,
): InteractionTaskEventItem {
  return {
    id: event.id,
    taskId: event.taskId,
    sequence: event.sequence,
    eventType: event.eventType,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  }
}

function toTaskSnapshotMessage(
  task: TaskDetail | TaskListItem,
): InteractionTaskSnapshotMessage {
  return {
    kind: "snapshot",
    name: "task",
    data: {
      task: toInteractionTaskRecord(task),
    },
  }
}

function toTaskEventsSnapshotMessage(args: {
  task: TaskDetail | TaskListItem
  events: {
    items: TaskEventItem[]
    nextSequence: number
  }
  afterSequence: number
  isTerminal: boolean
}): InteractionTaskEventsSnapshotMessage {
  return {
    kind: "snapshot",
    name: "task_events",
    data: {
      status: args.task.status,
      afterSequence: args.afterSequence,
      items: args.events.items.map(toInteractionTaskEventItem),
      nextSequence: args.events.nextSequence,
      terminal: args.isTerminal,
    },
  }
}

function toTaskTopicMessages(
  notification: TaskNotification,
): InteractionTaskStreamMessage[] {
  switch (notification.type) {
    case "task_upserted": {
      const messages: InteractionTaskStreamMessage[] = [
        {
          kind: "event",
          name: "task_upsert",
          data: {
            task: toInteractionTaskRecord(notification.task),
          },
        },
        {
          kind: "event",
          name: "task_status_changed",
          data: {
            status: notification.task.status,
          },
        },
      ]

      if (isTerminalTaskStatus(notification.task.status)) {
        messages.push({
          kind: "event",
          name: "task_ended",
          data: {
            status: notification.task.status,
            cursor: 0,
          },
        })
      }

      return messages
    }
    case "task_deleted":
      return [
        {
          kind: "event",
          name: "task_deleted",
          data: {
            taskId: notification.taskId,
            projectId: notification.projectId,
            orchestrationId: notification.orchestrationId,
          },
        },
      ]
    case "task_event_appended":
      return []
  }
}

function toTaskEventsTopicMessages(
  notification: TaskNotification,
): InteractionTaskStreamMessage[] {
  switch (notification.type) {
    case "task_upserted":
      return isTerminalTaskStatus(notification.task.status)
        ? [
            {
              kind: "event",
              name: "task_ended",
              data: {
                status: notification.task.status,
                cursor: 0,
              },
            },
          ]
        : []
    case "task_deleted":
      return [
        {
          kind: "event",
          name: "task_deleted",
          data: {
            taskId: notification.taskId,
            projectId: notification.projectId,
            orchestrationId: notification.orchestrationId,
          },
        },
      ]
    case "task_event_appended":
      return [
        {
          kind: "event",
          name: "task_event",
          data: {
            event: toInteractionTaskEventItem(notification.event),
          },
        },
      ]
  }
}

function toTaskStreamMessages(
  topic: InteractionTaskTopic,
  notification: TaskNotification,
): InteractionTaskStreamMessage[] {
  switch (topic.kind) {
    case "task":
      return toTaskTopicMessages(notification)
    case "task-events":
      return toTaskEventsTopicMessages(notification)
  }
}

function createSubscription(
  subscribe: (
    listener: (message: InteractionTaskStreamMessage) => void,
  ) => () => void,
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
    async getTaskSnapshot(taskId) {
      try {
        const task = await getTaskUseCase(args.repository, taskId)
        return toTaskSnapshotMessage(task)
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
    async getTaskEventsSnapshot(input) {
      try {
        const result = await getTaskEventsUseCase(
          args.repository,
          args.eventProjection,
          input,
        )

        return toTaskEventsSnapshotMessage({
          task: result.task,
          events: result.events,
          afterSequence: input.afterSequence ?? 0,
          isTerminal: result.isTerminal,
        })
      } catch (error) {
        throw toTaskAppError(error)
      }
    },
  }

  const stream: TaskInteractionStream = {
    selectTopic(topic) {
      return createSubscription((listener) => {
        return args.notificationSubscriber.subscribe({
          taskId: topic.id,
          listener(notification) {
            for (const message of toTaskStreamMessages(topic, notification)) {
              listener(message)
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
