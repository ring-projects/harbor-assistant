export type ResolvedDocumentWorkspacePath = {
  workspaceRootPath: string
  absolutePath: string
}

export interface DocumentWorkspacePolicy {
  getWorkspaceRoot(projectRootPath: string): Promise<string>
  resolveDocumentPath(input: {
    projectRootPath: string
    path: string
  }): Promise<ResolvedDocumentWorkspacePath>
}
