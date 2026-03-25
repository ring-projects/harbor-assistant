import { randomUUID } from "node:crypto"

import { createTask } from "../domain/task"
import { createTaskError } from "../errors"
import type { ProjectTaskPort } from "./project-task-port"
import type { TaskNotificationPublisher } from "./task-notification"
import type { TaskRecordStore } from "./task-record-store"
import { toTaskDetail, toTaskListItem, type TaskDetail } from "./task-read-models"
import type { TaskRepository } from "./task-repository"
import type { TaskRuntimePort } from "./task-runtime-port"

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export async function createTaskUseCase(args: {
  projectTaskPort: ProjectTaskPort
  taskRecordStore: TaskRecordStore
  repository: Pick<TaskRepository, "save">
  runtimePort: TaskRuntimePort
  notificationPublisher: TaskNotificationPublisher
  idGenerator?: () => string
}, input: {
  projectId: string
  prompt: string
  title?: string
  executor?: string | null
  model?: string | null
  executionMode?: string | null
}): Promise<TaskDetail> {
  const projectId = input.projectId.trim()
  const prompt = input.prompt.trim()
  const title = input.title?.trim()

  if (!projectId) {
    throw createTaskError().invalidInput("projectId is required")
  }

  if (!prompt) {
    throw createTaskError().invalidInput("prompt is required")
  }

  const project = await args.projectTaskPort.getProjectForTask(projectId)
  if (!project) {
    throw createTaskError().projectNotFound()
  }

  const runtimeConfig = {
    executor:
      normalizeNullableString(input.executor) ??
      project.settings.defaultExecutor ??
      "codex",
    model:
      normalizeNullableString(input.model) ??
      project.settings.defaultModel ??
      null,
    executionMode:
      normalizeNullableString(input.executionMode) ??
      project.settings.defaultExecutionMode ??
      "safe",
  }

  const task = createTask({
    id: args.idGenerator?.() ?? randomUUID(),
    projectId: project.projectId,
    prompt,
    titleSource: title ? "user" : "prompt",
    ...(title ? { title } : {}),
  })

  await args.taskRecordStore.create({
    task,
    projectPath: project.rootPath,
    runtimeConfig,
  })

  await args.notificationPublisher.publish({
    type: "task_upserted",
    projectId: task.projectId,
    task: toTaskListItem(task),
  })

  try {
    await args.runtimePort.startTaskExecution({
      taskId: task.id,
      projectId: task.projectId,
      projectPath: project.rootPath,
      prompt: task.prompt,
      runtimeConfig,
    })
  } catch (error) {
    const now = new Date()
    const failedTask = {
      ...task,
      status: "failed" as const,
      finishedAt: now,
      updatedAt: now,
    }
    await args.repository.save(failedTask)
    await args.notificationPublisher.publish({
      type: "task_upserted",
      projectId: failedTask.projectId,
      task: toTaskListItem(failedTask),
    })
    throw createTaskError().startFailed(
      error instanceof Error ? error.message : "task runtime failed to start",
    )
  }

  return toTaskDetail(task)
}
