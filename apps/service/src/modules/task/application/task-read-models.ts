import type { Task } from "../domain/task"

export type TaskRuntimeSnapshot = {
  executor: string | null
  model: string | null
  executionMode: string | null
}

export type TaskRecord = Task & TaskRuntimeSnapshot

export type TaskListItem = {
  id: string
  projectId: string
  title: string
  titleSource: Task["titleSource"]
  executor: string | null
  model: string | null
  executionMode: string | null
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

export function attachTaskRuntime(
  task: Task,
  runtime: TaskRuntimeSnapshot,
): TaskRecord {
  return {
    ...task,
    executor: runtime.executor,
    model: runtime.model,
    executionMode: runtime.executionMode,
  }
}

export function toTaskListItem(task: TaskRecord): TaskListItem {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    titleSource: task.titleSource,
    executor: task.executor,
    model: task.model,
    executionMode: task.executionMode,
    status: task.status,
    archivedAt: task.archivedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
  }
}

export function toTaskDetail(task: TaskRecord): TaskDetail {
  return {
    ...toTaskListItem(task),
    prompt: task.prompt,
  }
}
