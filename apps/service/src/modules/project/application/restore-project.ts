import { restoreProject, type Project } from "../domain/project"
import { createProjectError } from "../errors"
import type { ProjectRepository } from "./project-repository"

export async function restoreProjectUseCase(
  repository: Pick<ProjectRepository, "findById" | "save">,
  projectId: string,
  now = new Date(),
): Promise<Project> {
  const project = await repository.findById(projectId)
  if (!project) {
    throw createProjectError().notFound()
  }

  const next = restoreProject(project, now)
  await repository.save(next)
  return next
}
