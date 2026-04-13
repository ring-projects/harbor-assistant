export type UserDirectoryEntry = {
  id: string
  githubLogin: string
  name: string | null
}

export interface UserDirectory {
  findByGithubLogin(githubLogin: string): Promise<UserDirectoryEntry | null>
}
