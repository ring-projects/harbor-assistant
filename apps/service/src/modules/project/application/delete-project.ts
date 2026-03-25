import { createProjectError } from "../errors"
import type { ProjectRepository } from "./project-repository"

export async function deleteProjectUseCase(
  repository: ProjectRepository,
  projectId: string,
) {
  const project = await repository.findById(projectId)

  if (!project) {
    throw createProjectError().notFound()
  }

  await repository.delete(projectId)

  return {
    projectId,
  }
}
