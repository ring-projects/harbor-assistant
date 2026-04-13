import type { PrismaClient } from "@prisma/client"

import type {
  UserDirectory,
  UserDirectoryEntry,
} from "../../application/user-directory"

function toUserDirectoryEntry(user: {
  id: string
  githubLogin: string
  name: string | null
}): UserDirectoryEntry {
  return {
    id: user.id,
    githubLogin: user.githubLogin,
    name: user.name,
  }
}

export class PrismaUserDirectory implements UserDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  async findByGithubLogin(githubLogin: string): Promise<UserDirectoryEntry | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        githubLogin: githubLogin.trim(),
      },
      select: {
        id: true,
        githubLogin: true,
        name: true,
      },
    })

    return user ? toUserDirectoryEntry(user) : null
  }
}
