import type { TaskEventItem, TaskListItem } from "./task-read-models"

export type TaskNotification =
  | {
      type: "task_upserted"
      projectId: string
      task: TaskListItem
    }
  | {
      type: "task_deleted"
      projectId: string
      taskId: string
    }
  | {
      type: "task_event_appended"
      projectId: string
      taskId: string
      event: TaskEventItem
    }

export interface TaskNotificationPublisher {
  publish(notification: TaskNotification): Promise<void> | void
}

export interface TaskNotificationSubscriber {
  subscribe(args: {
    projectId?: string
    taskId?: string
    listener: (notification: TaskNotification) => void
  }): () => void
}
