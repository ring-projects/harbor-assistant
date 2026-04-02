import type { User as PrismaUser } from "@prisma/client"

import type { User } from "../../domain/user"

export function toDomainUser(user: PrismaUser): User {
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
