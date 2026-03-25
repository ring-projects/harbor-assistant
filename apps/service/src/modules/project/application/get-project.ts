import type { Project } from "../domain/project"
import { createProjectError } from "../errors"
import type { ProjectRepository } from "./project-repository"

export async function getProjectUseCase(
  repository: Pick<ProjectRepository, "findById">,
  projectId: string,
): Promise<Project> {
  const project = await repository.findById(projectId)
  if (!project) {
    throw createProjectError().notFound()
  }

  return project
}
