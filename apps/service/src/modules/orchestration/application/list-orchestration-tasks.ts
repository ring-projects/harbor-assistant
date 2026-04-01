import { createOrchestrationError } from "../errors"
import type { TaskRepository } from "../../task/application/task-repository"
import { toTaskListItem, type TaskListItem } from "../../task/application/task-read-models"
import type { OrchestrationRepository } from "./orchestration-repository"

export async function listOrchestrationTasksUseCase(
  args: {
    repository: Pick<OrchestrationRepository, "findById">
    taskRepository: Pick<TaskRepository, "listByOrchestration">
  },
  input: {
    orchestrationId: string
    includeArchived?: boolean
    limit?: number
  },
): Promise<TaskListItem[]> {
  const orchestrationId = input.orchestrationId.trim()
  if (!orchestrationId) {
    throw createOrchestrationError().invalidInput("orchestrationId is required")
  }

  const orchestration = await args.repository.findById(orchestrationId)
  if (!orchestration) {
    throw createOrchestrationError().notFound()
  }

  const tasks = await args.taskRepository.listByOrchestration({
    orchestrationId,
    includeArchived: input.includeArchived,
    limit: input.limit,
  })

  return tasks.map(toTaskListItem)
}
