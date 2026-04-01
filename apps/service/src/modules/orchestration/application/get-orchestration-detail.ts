import type { TaskRepository } from "../../task/application/task-repository"
import { createOrchestrationError } from "../errors"
import type { OrchestrationRepository } from "./orchestration-repository"
import { buildOrchestrationDetail } from "./shared"

export async function getOrchestrationDetailUseCase(
  args: {
    repository: Pick<OrchestrationRepository, "findById">
    taskRepository: Pick<TaskRepository, "listByOrchestration">
  },
  orchestrationId: string,
) {
  const normalizedId = orchestrationId.trim()
  if (!normalizedId) {
    throw createOrchestrationError().invalidInput("orchestrationId is required")
  }

  const orchestration = await args.repository.findById(normalizedId)
  if (!orchestration) {
    throw createOrchestrationError().notFound()
  }

  const tasks = await args.taskRepository.listByOrchestration({
    orchestrationId: normalizedId,
    includeArchived: true,
  })

  return buildOrchestrationDetail(orchestration, tasks)
}
