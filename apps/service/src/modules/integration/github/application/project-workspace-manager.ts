export interface ProjectWorkspaceManager {
  cloneRepository(args: {
    repositoryUrl: string
    branch: string | null
    targetPath: string
    accessToken: string
  }): Promise<void>
  syncRepository(args: {
    repositoryUrl: string
    rootPath: string
    accessToken: string
  }): Promise<void>
}
