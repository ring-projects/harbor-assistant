import { afterEach, describe, expect, it, vi } from "vitest"

import type { GitHubAppClient } from "../../integration/github/application/github-app-client"
import type { ProjectLocalPathManager } from "../../integration/github/application/project-local-path-manager"
import { PrismaGitHubInstallationRepository } from "../../integration/github/infrastructure/persistence/prisma-github-installation-repository"
import { createProjectTestApp } from "../../../../test/helpers/project-test-app"
import { createAuthSessionCookie } from "../../../../test/helpers/auth-session"
import {
  createTestDatabase,
  type TestDatabase,
} from "../../../../test/helpers/test-database"

function createGitHubAppClientStub(
  overrides: Partial<GitHubAppClient> = {},
): GitHubAppClient {
  return {
    buildInstallUrl: vi.fn(
      () => "https://github.com/apps/harbor/installations/new",
    ),
    getInstallation: vi.fn(),
    listInstallationRepositories: vi.fn(async () => [
      {
        nodeId: "repo_1",
        owner: "acme",
        name: "harbor-assistant",
        fullName: "acme/harbor-assistant",
        url: "https://github.com/acme/harbor-assistant.git",
        defaultBranch: "main",
        visibility: "private" as const,
      },
    ]),
    createInstallationAccessToken: vi.fn(async () => ({
      token: "installation-token",
      expiresAt: new Date("2026-04-02T01:00:00.000Z"),
    })),
    ...overrides,
  }
}

function createLocalPathManagerStub(
  overrides: Partial<ProjectLocalPathManager> = {},
): ProjectLocalPathManager {
  return {
    cloneRepository: vi.fn(async () => undefined),
    syncRepository: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe("project repository binding routes integration", () => {
  let testDatabase: TestDatabase | null = null

  afterEach(async () => {
    await testDatabase?.cleanup()
    testDatabase = null
  })

  it("persists and reloads a repository binding through the real Prisma route stack", async () => {
    testDatabase = await createTestDatabase()
    const session = await createAuthSessionCookie(testDatabase.prisma, {
      githubLogin: "owner-one",
    })
    const installationRepository = new PrismaGitHubInstallationRepository(
      testDatabase.prisma,
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

    const app = await createProjectTestApp(testDatabase.prisma, {
      githubAppClient: createGitHubAppClientStub(),
      localPathManager: createLocalPathManagerStub(),
      projectLocalPathRootDirectory: "/managed-workspaces",
    })

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      headers: {
        cookie: session.cookie,
      },
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: {
          type: "git",
          repositoryUrl: "https://github.com/acme/harbor-assistant.git",
          branch: "main",
        },
        repositoryBinding: {
          provider: "github",
          installationId: "12345",
          repositoryFullName: "acme/harbor-assistant",
        },
      },
    })

    expect(created.statusCode).toBe(201)

    const binding = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1/repository-binding",
      headers: {
        cookie: session.cookie,
      },
    })

    expect(binding.statusCode).toBe(200)
    expect(binding.json()).toMatchObject({
      ok: true,
      repositoryBinding: {
        projectId: "project-1",
        installationId: "12345",
        repositoryFullName: "acme/harbor-assistant",
        localPathState: "missing",
      },
    })

    await app.close()
  })
})
