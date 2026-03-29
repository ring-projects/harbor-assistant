import { randomUUID } from "node:crypto"

import type { AgentInputItem } from "../../../lib/agents"
import { normalizeNullableTaskEffort } from "../domain/task-effort"
import { createTask } from "../domain/task"
import { resolveAgentInput, summarizeAgentInput } from "../domain/task-input"
import { createTaskError } from "../errors"
import type { ProjectTaskPort } from "./project-task-port"
import type { TaskNotificationPublisher } from "./task-notification"
import type { TaskRecordStore } from "./task-record-store"
import {
  attachTaskRuntime,
  toTaskDetail,
  toTaskListItem,
  type TaskDetail,
} from "./task-read-models"
import type { TaskRepository } from "./task-repository"
import type { TaskRuntimePort } from "./task-runtime-port"
import { validateTaskEffortSelection } from "./validate-task-effort"

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export async function createTaskUseCase(args: {
  projectTaskPort: ProjectTaskPort
  taskRecordStore: TaskRecordStore
  repository: Pick<TaskRepository, "findById" | "save">
  runtimePort: TaskRuntimePort
  notificationPublisher: TaskNotificationPublisher
  idGenerator?: () => string
}, input: {
  projectId: string
  prompt?: string | null
  items?: AgentInputItem[] | null
  title?: string
  executor?: string | null
  model?: string | null
  executionMode?: string | null
  effort?: string | null
}): Promise<TaskDetail> {
  const projectId = input.projectId.trim()
  const agentInput = resolveAgentInput(input)
  const title = input.title?.trim()

  if (!projectId) {
    throw createTaskError().invalidInput("projectId is required")
  }

  if (!agentInput) {
    throw createTaskError().invalidInput("task input is required")
  }

  const requestedEffort = normalizeNullableTaskEffort(input.effort)
  if (input.effort !== undefined && input.effort !== null && !requestedEffort) {
    throw createTaskError().invalidEffort(`invalid effort "${input.effort}"`)
  }

  const prompt = summarizeAgentInput(agentInput)

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
    effort: requestedEffort,
  }
  runtimeConfig.effort = await validateTaskEffortSelection(runtimeConfig)

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
  const taskRecord = attachTaskRuntime(task, runtimeConfig)

  await args.notificationPublisher.publish({
    type: "task_upserted",
    projectId: task.projectId,
    task: toTaskListItem(taskRecord),
  })

  try {
    await args.runtimePort.startTaskExecution({
      taskId: task.id,
      projectId: task.projectId,
      projectPath: project.rootPath,
      input: agentInput,
      runtimeConfig,
    })
  } catch (error) {
    const persistedTask = await args.repository.findById(task.id)
    if (persistedTask?.status === "failed") {
      throw createTaskError().startFailed(
        error instanceof Error ? error.message : "task runtime failed to start",
      )
    }

    const now = new Date()
    const failedTask = {
      ...(persistedTask ?? task),
      status: "failed" as const,
      finishedAt: now,
      updatedAt: now,
    }
    await args.repository.save(failedTask)
    const failedTaskRecord = attachTaskRuntime(failedTask, runtimeConfig)
    await args.notificationPublisher.publish({
      type: "task_upserted",
      projectId: failedTask.projectId,
      task: toTaskListItem(failedTaskRecord),
    })
    throw createTaskError().startFailed(
      error instanceof Error ? error.message : "task runtime failed to start",
    )
  }

  return toTaskDetail(taskRecord)
}
