import { assertOrchestrationIsActive } from "../domain/orchestration"
import { createOrchestrationError } from "../errors"
import { createTaskUseCase } from "../../task/application/create-task"
import type { ProjectTaskPort } from "../../task/application/project-task-port"
import type { TaskNotificationPublisher } from "../../task/application/task-notification"
import type { TaskRecordStore } from "../../task/application/task-record-store"
import type { TaskRepository } from "../../task/application/task-repository"
import type { TaskRuntimePort } from "../../task/application/task-runtime-port"
import type { AgentInputItem } from "../../../lib/agents"
import type { TaskEffort } from "../../task/domain/task-effort"
import type { OrchestrationRepository } from "./orchestration-repository"

export async function createOrchestrationTaskUseCase(
  args: {
    repository: Pick<OrchestrationRepository, "findById">
    projectTaskPort: ProjectTaskPort
    taskRepository: Pick<TaskRepository, "findById" | "save"> & TaskRecordStore
    runtimePort: TaskRuntimePort
    notificationPublisher: TaskNotificationPublisher
  },
  input: {
    orchestrationId: string
    title?: string
    prompt?: string | null
    items?: AgentInputItem[] | null
    executor: string
    model: string
    executionMode: string
    effort: TaskEffort
  },
) {
  const orchestrationId = input.orchestrationId.trim()
  if (!orchestrationId) {
    throw createOrchestrationError().invalidInput("orchestrationId is required")
  }

  const orchestration = await args.repository.findById(orchestrationId)
  if (!orchestration) {
    throw createOrchestrationError().notFound()
  }

  assertOrchestrationIsActive(orchestration)

  return createTaskUseCase(
    {
      projectTaskPort: args.projectTaskPort,
      taskRecordStore: args.taskRepository,
      repository: args.taskRepository,
      runtimePort: args.runtimePort,
      notificationPublisher: args.notificationPublisher,
    },
    {
      projectId: orchestration.projectId,
      orchestrationId,
      title: input.title,
      prompt: input.prompt,
      items: input.items,
      executor: input.executor,
      model: input.model,
      executionMode: input.executionMode,
      effort: input.effort,
    },
  )
}
