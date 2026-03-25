import {
  type Project,
  type UpdateProjectSettingsInput,
  updateProjectSettings,
} from "../domain/project"
import { createProjectError } from "../errors"
import type { ProjectRepository } from "./project-repository"

export async function updateProjectSettingsUseCase(
  repository: ProjectRepository,
  input: {
    projectId: string
    changes: UpdateProjectSettingsInput
    now?: Date
  },
): Promise<Project> {
  const project = await repository.findById(input.projectId)
  if (!project) {
    throw createProjectError().notFound()
  }

  const next = updateProjectSettings(project, input.changes, input.now)
  await repository.save(next)
  return next
}
