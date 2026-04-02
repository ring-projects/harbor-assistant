export type AuthUser = {
  id: string
  githubLogin: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  status: "active" | "disabled"
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export type AuthSession = {
  authenticated: boolean
  user: AuthUser | null
}
