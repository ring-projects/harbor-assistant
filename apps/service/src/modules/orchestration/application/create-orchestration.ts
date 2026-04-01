import { randomUUID } from "node:crypto"

import type { ProjectRepository } from "../../project/application/project-repository"
import { createProjectError } from "../../project/errors"
import { createOrchestration } from "../domain/orchestration"
import { toOrchestrationReadModel } from "./orchestration-read-models"
import type { OrchestrationRepository } from "./orchestration-repository"

export async function createOrchestrationUseCase(
  args: {
    repository: OrchestrationRepository
    projectRepository: Pick<ProjectRepository, "findById">
    idGenerator?: () => string
  },
  input: {
    projectId: string
    title: string
    description?: string | null
    initPrompt?: string | null
    config?: Record<string, unknown> | null
  },
) {
  const projectId = input.projectId.trim()
  if (!projectId) {
    throw createProjectError().invalidInput("projectId is required")
  }

  const project = await args.projectRepository.findById(projectId)
  if (!project) {
    throw createProjectError().notFound()
  }

  const orchestration = createOrchestration({
    id: args.idGenerator?.() ?? randomUUID(),
    projectId,
    title: input.title,
    description: input.description,
    initPrompt: input.initPrompt,
    config: input.config,
  })

  await args.repository.save(orchestration)
  return toOrchestrationReadModel(orchestration)
}
