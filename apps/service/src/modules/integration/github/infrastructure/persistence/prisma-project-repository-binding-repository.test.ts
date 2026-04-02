import { afterEach, describe, expect, it } from "vitest"

import { PrismaProjectRepositoryBindingRepository } from "./prisma-project-repository-binding-repository"
import { PrismaGitHubInstallationRepository } from "./prisma-github-installation-repository"
import {
  createTestDatabase,
  type TestDatabase,
} from "../../../../../../test/helpers/test-database"
import { PrismaProjectRepository } from "../../../../project/infrastructure/persistence/prisma-project-repository"
import { createProject } from "../../../../project/domain/project"
import { createAuthSessionCookie } from "../../../../../../test/helpers/auth-session"

describe("PrismaProjectRepositoryBindingRepository", () => {
  let testDatabase: TestDatabase | null = null

  afterEach(async () => {
    await testDatabase?.cleanup()
    testDatabase = null
  })

  it("saves and reloads a repository binding for a git-backed project", async () => {
    testDatabase = await createTestDatabase()
    const projectRepository = new PrismaProjectRepository(testDatabase.prisma)
    const installationRepository = new PrismaGitHubInstallationRepository(
      testDatabase.prisma,
    )
    const bindingRepository = new PrismaProjectRepositoryBindingRepository(
      testDatabase.prisma,
    )
    const session = await createAuthSessionCookie(testDatabase.prisma, {
      githubLogin: "user-1",
    })

    await projectRepository.save(
      createProject({
        id: "project-1",
        ownerUserId: session.user.id,
        name: "Harbor Assistant",
        source: {
          type: "git",
          repositoryUrl: "https://github.com/acme/harbor-assistant.git",
          branch: "main",
        },
      }),
    )
    await installationRepository.save({
      id: "12345",
      accountType: "organization",
      accountLogin: "acme",
      targetType: "selected",
      status: "active",
      installedByUserId: session.user.id,
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      lastValidatedAt: null,
    })

    await bindingRepository.save({
      projectId: "project-1",
      provider: "github",
      installationId: "12345",
      repositoryNodeId: "repo_1",
      repositoryOwner: "acme",
      repositoryName: "harbor-assistant",
      repositoryFullName: "acme/harbor-assistant",
      repositoryUrl: "https://github.com/acme/harbor-assistant.git",
      defaultBranch: "main",
      visibility: "private",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      lastVerifiedAt: null,
    })

    await expect(bindingRepository.findByProjectId("project-1")).resolves.toMatchObject({
      projectId: "project-1",
      installationId: "12345",
      repositoryFullName: "acme/harbor-assistant",
    })
  })
})
