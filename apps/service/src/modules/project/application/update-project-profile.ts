import {
  type Project,
  type UpdateProjectProfileInput,
  updateProjectProfile,
} from "../domain/project"
import { createProjectError } from "../errors"
import type { ProjectRepository } from "./project-repository"

export async function updateProjectProfileUseCase(
  repository: Pick<ProjectRepository, "findById" | "findBySlug" | "save">,
  input: {
    projectId: string
    changes: UpdateProjectProfileInput
    now?: Date
  },
): Promise<Project> {
  const project = await repository.findById(input.projectId)
  if (!project) {
    throw createProjectError().notFound()
  }

  const next = updateProjectProfile(project, input.changes, input.now)
  const duplicateSlug = await repository.findBySlug(next.slug)
  if (duplicateSlug && duplicateSlug.id !== next.id) {
    throw createProjectError().duplicateSlug()
  }

  await repository.save(next)
  return next
}
