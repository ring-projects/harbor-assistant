import { createOrchestrationError } from "../errors"
import { toOrchestrationReadModel } from "./orchestration-read-models"
import type { OrchestrationRepository } from "./orchestration-repository"

export async function getOrchestrationUseCase(
  args: {
    repository: Pick<OrchestrationRepository, "findById">
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

  return toOrchestrationReadModel(orchestration)
}
