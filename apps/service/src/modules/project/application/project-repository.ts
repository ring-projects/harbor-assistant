import type { Project } from "../domain/project"

export interface ProjectRepository {
  findById(id: string): Promise<Project | null>
  findByNormalizedPath(normalizedPath: string): Promise<Project | null>
  findBySlug(slug: string): Promise<Project | null>
  list(): Promise<Project[]>
  save(project: Project): Promise<void>
  delete(id: string): Promise<void>
}
