import type {
  UserDirectory,
  UserDirectoryEntry,
} from "../application/user-directory"

export class InMemoryUserDirectory implements UserDirectory {
  private readonly usersByLogin = new Map<string, UserDirectoryEntry>()

  constructor(users: UserDirectoryEntry[] = []) {
    for (const user of users) {
      this.usersByLogin.set(user.githubLogin.toLowerCase(), user)
    }
  }

  async findByGithubLogin(githubLogin: string): Promise<UserDirectoryEntry | null> {
    return this.usersByLogin.get(githubLogin.trim().toLowerCase()) ?? null
  }
}
