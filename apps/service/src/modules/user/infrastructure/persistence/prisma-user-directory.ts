import type { PrismaClient } from "@prisma/client"

import type {
  UserDirectory,
  UserDirectoryEntry,
  UserProfile,
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

function toUserProfile(user: {
  id: string
  githubLogin: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  status: "active" | "disabled"
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}): UserProfile {
  return {
    id: user.id,
    githubLogin: user.githubLogin,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export class PrismaUserDirectory implements UserDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  async findByGithubLogin(
    githubLogin: string,
  ): Promise<UserDirectoryEntry | null> {
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

  async findById(userId: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId.trim(),
      },
      select: {
        id: true,
        githubLogin: true,
        name: true,
        email: true,
        avatarUrl: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return user ? toUserProfile(user) : null
  }
}
