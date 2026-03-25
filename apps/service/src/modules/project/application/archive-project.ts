import { archiveProject, type Project } from "../domain/project"
import { createProjectError } from "../errors"
import type { ProjectRepository } from "./project-repository"

export async function archiveProjectUseCase(
  repository: Pick<ProjectRepository, "findById" | "save">,
  projectId: string,
  now = new Date(),
): Promise<Project> {
  const project = await repository.findById(projectId)
  if (!project) {
    throw createProjectError().notFound()
  }

  const next = archiveProject(project, now)
  await repository.save(next)
  return next
}
