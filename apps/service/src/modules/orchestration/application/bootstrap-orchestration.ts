import { randomUUID } from "node:crypto"

import type { AgentInputItem } from "../../../lib/agents"
import type { ProjectRepository } from "../../project/application/project-repository"
import { createProjectError } from "../../project/errors"
import type { TaskNotificationPublisher } from "../../task/application/task-notification"
import {
  attachTaskRuntime,
  toTaskDetail,
  toTaskListItem,
  type TaskDetail,
} from "../../task/application/task-read-models"
import type { TaskRepository } from "../../task/application/task-repository"
import type {
  TaskRuntimeConfig,
  TaskRuntimePort,
} from "../../task/application/task-runtime-port"
import { validateTaskRuntimeConfig } from "../../task/application/validate-task-effort"
import { resolveAgentInput, summarizeAgentInput } from "../../task/domain/task-input"
import {
  normalizeNullableTaskEffort,
  type TaskEffort,
} from "../../task/domain/task-effort"
import { createTask } from "../../task/domain/task"
import { TASK_ERROR_CODES, createTaskError } from "../../task/errors"
import { createOrchestration } from "../domain/orchestration"
import { toOrchestrationReadModel } from "./orchestration-read-models"
import type { OrchestrationBootstrapStore } from "./orchestration-bootstrap-store"

export type BootstrapOrchestrationResult = {
  orchestration: ReturnType<typeof toOrchestrationReadModel>
  task: TaskDetail
  bootstrap: {
    runtimeStarted: boolean
    warning: {
      code: string
      message: string
    } | null
  }
}

export async function bootstrapOrchestrationUseCase(
  args: {
    bootstrapStore: OrchestrationBootstrapStore
    projectRepository: Pick<ProjectRepository, "findById">
    taskRepository: Pick<TaskRepository, "save">
    runtimePort: TaskRuntimePort
    notificationPublisher: TaskNotificationPublisher
    orchestrationIdGenerator?: () => string
    taskIdGenerator?: () => string
  },
  input: {
    projectId: string
    orchestration: {
      title: string
      description?: string | null
    }
    initialTask: {
      title?: string
      prompt?: string | null
      items?: AgentInputItem[] | null
      executor: string
      model: string
      executionMode: string
      effort: TaskEffort
    }
  },
): Promise<BootstrapOrchestrationResult> {
  function requireProjectWorkspaceRoot(rootPath: string | null) {
    if (!rootPath) {
      throw createTaskError().invalidInput("project workspace is not available")
    }

    return rootPath
  }

  const projectId = input.projectId.trim()
  if (!projectId) {
    throw createProjectError().invalidInput("projectId is required")
  }

  const agentInput = resolveAgentInput(input.initialTask)
  if (!agentInput) {
    throw createTaskError().invalidInput("task input is required")
  }

  const requestedEffort = normalizeNullableTaskEffort(input.initialTask.effort)
  if (!requestedEffort) {
    throw createTaskError().invalidEffort(
      `invalid effort "${input.initialTask.effort}"`,
    )
  }

  const executor = input.initialTask.executor.trim()
  const model = input.initialTask.model.trim()
  const executionMode = input.initialTask.executionMode.trim()
  const title = input.initialTask.title?.trim()

  if (!executor) {
    throw createTaskError().invalidInput("executor is required")
  }

  if (!model) {
    throw createTaskError().invalidInput("model is required")
  }

  if (!executionMode) {
    throw createTaskError().invalidInput("executionMode is required")
  }

  const project = await args.projectRepository.findById(projectId)
  if (!project) {
    throw createProjectError().notFound()
  }
  const projectRootPath = requireProjectWorkspaceRoot(project.rootPath)

  const validatedRuntimeConfig = await validateTaskRuntimeConfig({
    executor,
    model,
    effort: requestedEffort,
  })
  const runtimeConfig: TaskRuntimeConfig = {
    ...validatedRuntimeConfig,
    executionMode,
  }

  const orchestration = createOrchestration({
    id: args.orchestrationIdGenerator?.() ?? randomUUID(),
    projectId,
    title: input.orchestration.title,
    description: input.orchestration.description,
  })
  const task = createTask({
    id: args.taskIdGenerator?.() ?? randomUUID(),
    projectId,
    orchestrationId: orchestration.id,
    prompt: summarizeAgentInput(agentInput),
    titleSource: title ? "user" : "prompt",
    ...(title ? { title } : {}),
  })

  await args.bootstrapStore.create({
    orchestration,
    task,
    projectPath: projectRootPath,
    runtimeConfig,
  })

  const orchestrationReadModel = toOrchestrationReadModel(orchestration)
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

    return {
      orchestration: orchestrationReadModel,
      task: toTaskDetail(taskRecord),
      bootstrap: {
        runtimeStarted: true,
        warning: null,
      },
    }
  } catch (error) {
    const now = new Date()
    const failedTask = {
      ...task,
      status: "failed" as const,
      finishedAt: now,
      updatedAt: now,
    }

    await args.taskRepository.save(failedTask)
    const failedTaskRecord = attachTaskRuntime(failedTask, runtimeConfig)
    await args.notificationPublisher.publish({
      type: "task_upserted",
      projectId: failedTask.projectId,
      task: toTaskListItem(failedTaskRecord),
    })

    return {
      orchestration: orchestrationReadModel,
      task: toTaskDetail(failedTaskRecord),
      bootstrap: {
        runtimeStarted: false,
        warning: {
          code: TASK_ERROR_CODES.START_FAILED,
          message:
            error instanceof Error
              ? error.message
              : "task runtime failed to start",
        },
      },
    }
  }
}
