import type { Task } from "../domain/task"

export type TaskListItem = {
  id: string
  projectId: string
  title: string
  status: Task["status"]
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  finishedAt: Date | null
}

export type TaskDetail = TaskListItem & {
  prompt: string
}

export type TaskEventItem = {
  id: string
  taskId: string
  sequence: number
  eventType: string
  payload: Record<string, unknown>
  createdAt: Date
}

export type TaskEventStream = {
  taskId: string
  items: TaskEventItem[]
  nextSequence: number
}

export type DeleteTaskResult = {
  taskId: string
  projectId: string
}

export function toTaskListItem(task: Task): TaskListItem {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    status: task.status,
    archivedAt: task.archivedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
  }
}

export function toTaskDetail(task: Task): TaskDetail {
  return {
    ...toTaskListItem(task),
    prompt: task.prompt,
  }
}
