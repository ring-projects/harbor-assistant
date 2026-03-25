import type { Project } from "../domain/project"
import type { ProjectRepository } from "./project-repository"

export async function listProjectsUseCase(
  repository: Pick<ProjectRepository, "list">,
): Promise<Project[]> {
  return repository.list()
}
