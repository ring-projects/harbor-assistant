export type GitCommandResult = {
  stdout: string
  stderr: string
  exitCode: number | null
}

export interface GitRepository {
  getRepositoryRoot(path: string): Promise<GitCommandResult>
  getCurrentBranch(path: string): Promise<GitCommandResult>
  getStatus(path: string): Promise<GitCommandResult>
  listBranches(path: string): Promise<GitCommandResult>
  getDiff(path: string): Promise<GitCommandResult>
  checkoutBranch(path: string, branchName: string): Promise<GitCommandResult>
  createBranch(
    path: string,
    input: {
      branchName: string
      checkout?: boolean
      fromRef?: string | null
    },
  ): Promise<GitCommandResult>
}
