import { randomUUID } from "node:crypto"

import type { AgentInputItem } from "../../../lib/agents"
import {
  normalizeNullableTaskEffort,
  type TaskEffort,
} from "../domain/task-effort"
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
import { validateTaskRuntimeConfig } from "./validate-task-effort"

export async function createTaskUseCase(args: {
  projectTaskPort: ProjectTaskPort
  taskRecordStore: TaskRecordStore
  repository: Pick<TaskRepository, "findById" | "save">
  runtimePort: TaskRuntimePort
  notificationPublisher: TaskNotificationPublisher
  idGenerator?: () => string
}, input: {
  projectId: string
  orchestrationId: string
  prompt?: string | null
  items?: AgentInputItem[] | null
  title?: string
  executor: string
  model: string
  executionMode: string
  effort: TaskEffort
}): Promise<TaskDetail> {
  function requireProjectRootPath(rootPath: string | null) {
    if (!rootPath) {
      throw createTaskError().invalidInput("project root path is not available")
    }

    return rootPath
  }

  const projectId = input.projectId.trim()
  const orchestrationId = input.orchestrationId.trim()
  const agentInput = resolveAgentInput(input)
  const title = input.title?.trim()

  if (!projectId) {
    throw createTaskError().invalidInput("projectId is required")
  }
  if (!orchestrationId) {
    throw createTaskError().invalidInput("orchestrationId is required")
  }
  if (!agentInput) {
    throw createTaskError().invalidInput("task input is required")
  }

  const requestedEffort = normalizeNullableTaskEffort(input.effort)
  if (!requestedEffort) {
    throw createTaskError().invalidEffort(`invalid effort "${input.effort}"`)
  }

  const executor = input.executor.trim()
  const model = input.model.trim()
  const executionMode = input.executionMode.trim()

  if (!executor) {
    throw createTaskError().invalidInput("executor is required")
  }

  if (!model) {
    throw createTaskError().invalidInput("model is required")
  }

  if (!executionMode) {
    throw createTaskError().invalidInput("executionMode is required")
  }

  const prompt = summarizeAgentInput(agentInput)

  const project = await args.projectTaskPort.getProjectForTask(projectId)
  if (!project) {
    throw createTaskError().projectNotFound()
  }
  const projectRootPath = requireProjectRootPath(project.rootPath)

  const validatedRuntimeConfig = await validateTaskRuntimeConfig({
    executor,
    model,
    effort: requestedEffort,
  })
  const runtimeConfig = {
    ...validatedRuntimeConfig,
    executionMode,
  }

  const task = createTask({
    id: args.idGenerator?.() ?? randomUUID(),
    projectId: project.projectId,
    orchestrationId,
    prompt,
    titleSource: title ? "user" : "prompt",
    ...(title ? { title } : {}),
  })

  await args.taskRecordStore.create({
    task,
    projectPath: projectRootPath,
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
      projectPath: projectRootPath,
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
