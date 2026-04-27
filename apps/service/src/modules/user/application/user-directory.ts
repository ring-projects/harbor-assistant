export type UserDirectoryEntry = {
  id: string
  githubLogin: string
  name: string | null
}

export type UserProfile = {
  id: string
  githubLogin: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  status: "active" | "disabled"
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UserDirectory {
  findByGithubLogin(githubLogin: string): Promise<UserDirectoryEntry | null>
  findById(userId: string): Promise<UserProfile | null>
}
