import { createOrchestrationError } from "../errors"
import type { OrchestrationRepository } from "./orchestration-repository"
import type { OrchestrationTaskPort } from "./orchestration-task-port"

export async function listOrchestrationTasksUseCase(
  args: {
    repository: Pick<OrchestrationRepository, "findById">
    taskPort: OrchestrationTaskPort
  },
  input: {
    orchestrationId: string
    includeArchived?: boolean
    limit?: number
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

  return args.taskPort.listTasksForOrchestration({
    orchestrationId,
    includeArchived: input.includeArchived,
    limit: input.limit,
  })
}
