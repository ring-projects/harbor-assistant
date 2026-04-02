export type ProjectRepositoryBinding = {
  projectId: string
  provider: "github"
  installationId: string
  repositoryNodeId: string | null
  repositoryOwner: string
  repositoryName: string
  repositoryFullName: string
  repositoryUrl: string
  defaultBranch: string | null
  visibility: "public" | "private" | "internal" | null
  createdAt: Date
  updatedAt: Date
  lastVerifiedAt: Date | null
}

export interface ProjectRepositoryBindingRepository {
  findByProjectId(projectId: string): Promise<ProjectRepositoryBinding | null>
  save(binding: ProjectRepositoryBinding): Promise<void>
  deleteByProjectId(projectId: string): Promise<void>
}
