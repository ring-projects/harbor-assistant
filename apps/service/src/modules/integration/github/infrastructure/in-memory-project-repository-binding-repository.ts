import type {
  ProjectRepositoryBinding,
  ProjectRepositoryBindingRepository,
} from "../application/project-repository-binding-repository"

export class InMemoryProjectRepositoryBindingRepository
  implements ProjectRepositoryBindingRepository
{
  private readonly bindings = new Map<string, ProjectRepositoryBinding>()

  async findByProjectId(projectId: string): Promise<ProjectRepositoryBinding | null> {
    return this.bindings.get(projectId) ?? null
  }

  async save(binding: ProjectRepositoryBinding): Promise<void> {
    this.bindings.set(binding.projectId, binding)
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    this.bindings.delete(projectId)
  }
}
