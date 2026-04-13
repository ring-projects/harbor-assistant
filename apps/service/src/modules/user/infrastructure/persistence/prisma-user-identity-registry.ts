import type { AuthProvider, PrismaClient } from "@prisma/client"

import { ERROR_CODES } from "../../../../constants/errors"
import { AppError } from "../../../../lib/errors/app-error"
import type {
  UpsertGitHubUserInput,
  UserIdentityRegistry,
} from "../../application/user-identity-registry"
import type { User } from "../../domain/user"
import { toDomainUser } from "./user-mapper"

export class PrismaUserIdentityRegistry implements UserIdentityRegistry {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertGitHubUser(input: UpsertGitHubUserInput): Promise<User> {
    const now = input.now ?? new Date()
    const provider: AuthProvider = "github"

    const user = await this.prisma.$transaction(async (tx) => {
      const identity = await tx.authIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider,
            providerUserId: input.providerUserId,
          },
        },
      })

      const currentUser = identity
        ? await tx.user.findUnique({
            where: {
              id: identity.userId,
            },
          })
        : null

      if (!identity) {
        const conflictingUser = await tx.user.findUnique({
          where: {
            githubLogin: input.login,
          },
        })

        if (conflictingUser) {
          throw new AppError(
            ERROR_CODES.AUTH_IDENTITY_CONFLICT,
            409,
            "GitHub identity could not be linked to the existing Harbor user.",
          )
        }
      }

      const userRecord = currentUser
        ? await tx.user.update({
            where: {
              id: currentUser.id,
            },
            data: {
              githubLogin: input.login,
              email: input.email,
              name: input.name,
              avatarUrl: input.avatarUrl,
              lastLoginAt: now,
            },
          })
        : await tx.user.create({
            data: {
              githubLogin: input.login,
              email: input.email,
              name: input.name,
              avatarUrl: input.avatarUrl,
              lastLoginAt: now,
            },
          })

      if (identity) {
        await tx.authIdentity.update({
          where: {
            id: identity.id,
          },
          data: {
            providerLogin: input.login,
            providerEmail: input.email,
          },
        })
      } else {
        await tx.authIdentity.create({
          data: {
            userId: userRecord.id,
            provider,
            providerUserId: input.providerUserId,
            providerLogin: input.login,
            providerEmail: input.email,
          },
        })
      }

      return userRecord
    })

    return toDomainUser(user)
  }
}
