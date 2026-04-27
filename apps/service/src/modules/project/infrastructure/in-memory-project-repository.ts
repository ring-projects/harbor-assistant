import type { Project } from "../domain/project"
import type { ProjectRepository } from "../application/project-repository"

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, Project>()

  async findById(id: string): Promise<Project | null> {
    return this.projects.get(id) ?? null
  }

  async findByIdAndOwnerUserId(
    id: string,
    ownerUserId: string,
  ): Promise<Project | null> {
    const project = this.projects.get(id) ?? null
    if (
      !project ||
      (project.ownerUserId !== null && project.ownerUserId !== ownerUserId)
    ) {
      return null
    }

    return project
  }

  async findByNormalizedPath(normalizedPath: string): Promise<Project | null> {
    for (const project of this.projects.values()) {
      if (project.normalizedPath === normalizedPath) {
        return project
      }
    }

    return null
  }

  async findBySlug(slug: string): Promise<Project | null> {
    for (const project of this.projects.values()) {
      if (project.slug === slug) {
        return project
      }
    }

    return null
  }

  async list(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort(
      (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
    )
  }

  async listByOwnerUserId(ownerUserId: string): Promise<Project[]> {
    return Array.from(this.projects.values())
      .filter((project) => project.ownerUserId === ownerUserId)
      .sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      )
  }

  async save(project: Project): Promise<void> {
    this.projects.set(project.id, project)
  }

  async delete(id: string): Promise<void> {
    this.projects.delete(id)
  }
}
