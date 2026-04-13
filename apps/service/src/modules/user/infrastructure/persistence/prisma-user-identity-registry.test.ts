import { afterEach, describe, expect, it } from "vitest"

import { ERROR_CODES } from "../../../../constants/errors"
import { AppError } from "../../../../lib/errors/app-error"
import {
  createTestDatabase,
  type TestDatabase,
} from "../../../../../test/helpers/test-database"
import { PrismaUserIdentityRegistry } from "./prisma-user-identity-registry"

describe("PrismaUserIdentityRegistry", () => {
  let testDatabase: TestDatabase | null = null

  afterEach(async () => {
    await testDatabase?.cleanup()
    testDatabase = null
  })

  it("creates a new user and auth identity for a first-time GitHub login", async () => {
    testDatabase = await createTestDatabase()
    const registry = new PrismaUserIdentityRegistry(testDatabase.prisma)

    const user = await registry.upsertGitHubUser({
      providerUserId: "github-user-1",
      login: "octocat",
      email: "octocat@example.com",
      name: "Octo Cat",
      avatarUrl: "https://avatars.example.com/u/1",
    })

    expect(user.githubLogin).toBe("octocat")

    const identity = await testDatabase.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: "github",
          providerUserId: "github-user-1",
        },
      },
    })

    expect(identity).toMatchObject({
      userId: user.id,
      provider: "github",
      providerUserId: "github-user-1",
      providerLogin: "octocat",
      providerEmail: "octocat@example.com",
    })
  })

  it("updates the existing Harbor user when the same GitHub identity logs in with a new login", async () => {
    testDatabase = await createTestDatabase()
    const registry = new PrismaUserIdentityRegistry(testDatabase.prisma)

    const firstLogin = await registry.upsertGitHubUser({
      providerUserId: "github-user-1",
      login: "octocat",
      email: "octocat@example.com",
      name: "Octo Cat",
      avatarUrl: "https://avatars.example.com/u/1",
    })

    const secondLogin = await registry.upsertGitHubUser({
      providerUserId: "github-user-1",
      login: "octocat-renamed",
      email: "octocat-renamed@example.com",
      name: "Octo Cat Renamed",
      avatarUrl: "https://avatars.example.com/u/2",
    })

    expect(secondLogin.id).toBe(firstLogin.id)
    expect(secondLogin.githubLogin).toBe("octocat-renamed")
    expect(secondLogin.email).toBe("octocat-renamed@example.com")

    const identity = await testDatabase.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: "github",
          providerUserId: "github-user-1",
        },
      },
    })

    expect(identity).toMatchObject({
      userId: firstLogin.id,
      providerLogin: "octocat-renamed",
      providerEmail: "octocat-renamed@example.com",
    })
  })

  it("rejects linking a new GitHub identity to an existing Harbor user with the same login", async () => {
    testDatabase = await createTestDatabase()
    const registry = new PrismaUserIdentityRegistry(testDatabase.prisma)

    await testDatabase.prisma.user.create({
      data: {
        githubLogin: "octocat",
      },
    })

    await expect(
      registry.upsertGitHubUser({
        providerUserId: "github-user-2",
        login: "octocat",
        email: "octocat@example.com",
        name: "Octo Cat",
        avatarUrl: "https://avatars.example.com/u/1",
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_IDENTITY_CONFLICT,
      statusCode: 409,
    } satisfies Partial<AppError>)
  })
})
