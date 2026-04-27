import type { ProjectRepository } from "../../project/application/project-repository"
import { createProjectError } from "../../project/errors"
import { toOrchestrationReadModel } from "./orchestration-read-models"
import type {
  OrchestrationListSurface,
  OrchestrationRepository,
} from "./orchestration-repository"

export async function listProjectOrchestrationsUseCase(
  args: {
    repository: Pick<OrchestrationRepository, "listByProject">
    projectRepository: Pick<ProjectRepository, "findById">
  },
  input: {
    projectId: string
    surface?: OrchestrationListSurface
  },
) {
  const normalizedProjectId = input.projectId.trim()
  if (!normalizedProjectId) {
    throw createProjectError().invalidInput("projectId is required")
  }

  const project = await args.projectRepository.findById(normalizedProjectId)
  if (!project) {
    throw createProjectError().notFound()
  }

  const orchestrations = await args.repository.listByProject({
    projectId: normalizedProjectId,
    surface: input.surface,
  })

  return orchestrations.map((orchestration) =>
    toOrchestrationReadModel(orchestration),
  )
}
