import type {
  UserDirectory,
  UserDirectoryEntry,
  UserProfile,
} from "../application/user-directory"

export class InMemoryUserDirectory implements UserDirectory {
  private readonly usersByLogin = new Map<string, UserDirectoryEntry>()
  private readonly usersById = new Map<string, UserProfile>()

  constructor(users: UserProfile[] = []) {
    for (const user of users) {
      this.usersByLogin.set(user.githubLogin.toLowerCase(), user)
      this.usersById.set(user.id, user)
    }
  }

  async findByGithubLogin(
    githubLogin: string,
  ): Promise<UserDirectoryEntry | null> {
    return this.usersByLogin.get(githubLogin.trim().toLowerCase()) ?? null
  }

  async findById(userId: string): Promise<UserProfile | null> {
    return this.usersById.get(userId.trim()) ?? null
  }
}
