export type UserStatus = "active" | "disabled"

export type User = {
  id: string
  githubLogin: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  status: UserStatus
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}
