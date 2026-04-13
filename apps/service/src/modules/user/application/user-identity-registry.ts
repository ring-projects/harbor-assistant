import type { User } from "../domain/user"

export type UpsertGitHubUserInput = {
  providerUserId: string
  login: string
  email: string | null
  name: string | null
  avatarUrl: string | null
  now?: Date
}

export interface UserIdentityRegistry {
  upsertGitHubUser(input: UpsertGitHubUserInput): Promise<User>
}
