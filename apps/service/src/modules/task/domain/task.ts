import { createTaskError } from "../errors"

export type TaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type TaskTitleSource = "prompt" | "agent" | "user"

export type Task = {
  id: string
  projectId: string
  orchestrationId: string
  prompt: string
  title: string
  titleSource: TaskTitleSource
  status: TaskStatus
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  finishedAt: Date | null
}

export function createTask(input: {
  id: string
  projectId: string
  orchestrationId: string
  prompt: string
  title?: string
  titleSource?: TaskTitleSource
  status?: TaskStatus
  archivedAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
  startedAt?: Date | null
  finishedAt?: Date | null
}): Task {
  const id = input.id.trim()
  const projectId = input.projectId.trim()
  const orchestrationId = input.orchestrationId.trim()
  const prompt = input.prompt.trim()
  const title = (input.title ?? input.prompt).trim()
  const createdAt = input.createdAt ?? new Date()
  const updatedAt = input.updatedAt ?? createdAt

  if (!id) {
    throw createTaskError().invalidInput("id is required")
  }
  if (!projectId) {
    throw createTaskError().invalidInput("projectId is required")
  }
  if (!prompt) {
    throw createTaskError().invalidInput("prompt is required")
  }
  if (!orchestrationId) {
    throw createTaskError().invalidInput("orchestrationId is required")
  }
  if (!title) {
    throw createTaskError().invalidTitle("title is required")
  }

  return {
    id,
    projectId,
    orchestrationId,
    prompt,
    title,
    titleSource: input.titleSource ?? "prompt",
    status: input.status ?? "queued",
    archivedAt: input.archivedAt ?? null,
    createdAt,
    updatedAt,
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt ?? null,
  }
}

export function isTerminalTaskStatus(status: TaskStatus) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  )
}

export function archiveTask(task: Task, now = new Date()): Task {
  if (task.archivedAt) {
    throw createTaskError().invalidArchiveState("task is already archived")
  }

  if (!isTerminalTaskStatus(task.status)) {
    throw createTaskError().invalidArchiveState(
      "only terminal tasks can be archived",
    )
  }

  return {
    ...task,
    archivedAt: now,
    updatedAt: now,
  }
}

export function updateTaskTitle(
  task: Task,
  title: string,
  now = new Date(),
): Task {
  const normalizedTitle = title.trim()
  if (!normalizedTitle) {
    throw createTaskError().invalidTitle("title is required")
  }

  return {
    ...task,
    title: normalizedTitle,
    titleSource: "user",
    updatedAt: now,
  }
}

export function assertTaskCanDelete(task: Task) {
  if (!isTerminalTaskStatus(task.status)) {
    throw createTaskError().invalidDeleteState(
      "only terminal tasks can be deleted",
    )
  }
}

export function assertTaskCanResume(task: Task) {
  if (task.archivedAt) {
    throw createTaskError().invalidResumeState(
      "archived tasks cannot be resumed",
    )
  }

  if (!isTerminalTaskStatus(task.status)) {
    throw createTaskError().invalidResumeState(
      "only terminal tasks can be resumed",
    )
  }
}

export function assertTaskCanCancel(task: Task) {
  if (task.archivedAt) {
    throw createTaskError().invalidCancelState(
      "archived tasks cannot be cancelled",
    )
  }

  if (isTerminalTaskStatus(task.status)) {
    return
  }

  if (task.status !== "running") {
    throw createTaskError().invalidCancelState(
      "only running tasks can be cancelled",
    )
  }
}
