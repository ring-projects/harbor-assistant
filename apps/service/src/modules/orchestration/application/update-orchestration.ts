import {
  resolveOrchestrationTitle,
  type Orchestration,
} from "../domain/orchestration"
import { createOrchestrationError } from "../errors"
import { toOrchestrationReadModel } from "./orchestration-read-models"
import type { OrchestrationRepository } from "./orchestration-repository"

function mergeOrchestrationUpdate(
  orchestration: Orchestration,
  input: {
    title?: string | null
    description?: string | null
  },
): Orchestration {
  return {
    ...orchestration,
    title:
      input.title === undefined
        ? orchestration.title
        : resolveOrchestrationTitle({
            title: input.title,
            fallbackTitle: orchestration.title,
          }),
    description:
      input.description === undefined
        ? orchestration.description
        : input.description?.trim() || null,
    updatedAt: new Date(),
  }
}

export async function updateOrchestrationUseCase(
  deps: {
    repository: Pick<OrchestrationRepository, "findById" | "save">
  },
  input: {
    orchestrationId: string
    title?: string | null
    description?: string | null
  },
) {
  const orchestrationId = input.orchestrationId.trim()
  if (!orchestrationId) {
    throw createOrchestrationError().invalidInput("orchestrationId is required")
  }

  const current = await deps.repository.findById(orchestrationId)
  if (!current) {
    throw createOrchestrationError().notFound()
  }

  const updated = mergeOrchestrationUpdate(current, input)
  await deps.repository.save(updated)

  return toOrchestrationReadModel(updated)
}
