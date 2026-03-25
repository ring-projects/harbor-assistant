import { EventEmitter } from "node:events"

import type {
  TaskNotification,
  TaskNotificationPublisher,
  TaskNotificationSubscriber,
} from "../../application/task-notification"

const TASK_NOTIFICATION_EVENT = "task-notification"

function matchesTaskFilter(
  notification: TaskNotification,
  args: {
    projectId?: string
    taskId?: string
  },
) {
  if (args.projectId && notification.projectId !== args.projectId) {
    return false
  }

  if (!args.taskId) {
    return true
  }

  switch (notification.type) {
    case "task_deleted":
    case "task_event_appended":
      return notification.taskId === args.taskId
    case "task_upserted":
      return notification.task.id === args.taskId
  }
}

export function createInMemoryTaskNotificationBus(): {
  publisher: TaskNotificationPublisher
  subscriber: TaskNotificationSubscriber
} {
  const emitter = new EventEmitter()

  return {
    publisher: {
      publish(notification) {
        emitter.emit(TASK_NOTIFICATION_EVENT, notification)
      },
    },
    subscriber: {
      subscribe(args) {
        const handler = (notification: TaskNotification) => {
          if (!matchesTaskFilter(notification, args)) {
            return
          }

          args.listener(notification)
        }

        emitter.on(TASK_NOTIFICATION_EVENT, handler)
        return () => {
          emitter.off(TASK_NOTIFICATION_EVENT, handler)
        }
      },
    },
  }
}
