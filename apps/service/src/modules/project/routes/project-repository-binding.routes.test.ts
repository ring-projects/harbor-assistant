import Fastify from "fastify"
import { describe, expect, it, vi } from "vitest"

import { registerProjectModuleRoutes } from "."
import errorHandlerPlugin from "../../../plugins/error-handler"
import { InMemoryGitHubInstallationRepository } from "../../integration/github/infrastructure/in-memory-github-installation-repository"
import { InMemoryProjectRepositoryBindingRepository } from "../../integration/github/infrastructure/in-memory-project-repository-binding-repository"
import type { GitHubAppClient } from "../../integration/github/application/github-app-client"
import type { ProjectWorkspaceManager } from "../../integration/github/application/project-workspace-manager"
import { InMemoryProjectRepository } from "../infrastructure/in-memory-project-repository"
import { createSimpleProjectPathPolicy } from "../infrastructure/simple-project-path-policy"

async function createApp(args?: {
  projectRepository?: InMemoryProjectRepository
  installationRepository?: InMemoryGitHubInstallationRepository
  bindingRepository?: InMemoryProjectRepositoryBindingRepository
  githubAppClient?: GitHubAppClient
  workspaceManager?: ProjectWorkspaceManager
}) {
  const app = Fastify({ logger: false })

  app.decorateRequest("auth", null)
  app.addHook("onRequest", async (request) => {
    request.auth = {
      sessionId: "session-1",
      userId: "user-1",
      user: {
        id: "user-1",
        githubLogin: "user-1",
        name: "User One",
        email: "user-1@example.com",
        avatarUrl: null,
        status: "active",
        lastLoginAt: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    }
  })
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerProjectModuleRoutes(instance, {
        repository: args?.projectRepository ?? new InMemoryProjectRepository(),
        pathPolicy: createSimpleProjectPathPolicy(),
        installationRepository:
          args?.installationRepository ?? new InMemoryGitHubInstallationRepository(),
        repositoryBindingRepository:
          args?.bindingRepository ?? new InMemoryProjectRepositoryBindingRepository(),
        githubAppClient: args?.githubAppClient ?? createGitHubAppClientStub(),
        workspaceManager: args?.workspaceManager ?? createWorkspaceManagerStub(),
        workspaceRootDirectory: "/managed-workspaces",
      })
    },
    { prefix: "/v1" },
  )
  await app.ready()
  return app
}

function createGitHubAppClientStub(
  overrides: Partial<GitHubAppClient> = {},
): GitHubAppClient {
  return {
    buildInstallUrl: vi.fn(() => "https://github.com/apps/harbor/installations/new"),
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

function createWorkspaceManagerStub(
  overrides: Partial<ProjectWorkspaceManager> = {},
): ProjectWorkspaceManager {
  return {
    cloneRepository: vi.fn(async () => undefined),
    syncRepository: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe("project repository binding routes", () => {
  it("creates a git-backed project with a GitHub repository binding and exposes the binding view", async () => {
    const installationRepository = new InMemoryGitHubInstallationRepository()
    await installationRepository.save({
      id: "12345",
      accountType: "organization",
      accountLogin: "acme",
      targetType: "selected",
      status: "active",
      installedByUserId: "user-1",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      lastValidatedAt: null,
    })

    const app = await createApp({
      installationRepository,
    })

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
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
    })

    expect(binding.statusCode).toBe(200)
    expect(binding.json()).toEqual({
      ok: true,
      repositoryBinding: {
        projectId: "project-1",
        provider: "github",
        installationId: "12345",
        repositoryOwner: "acme",
        repositoryName: "harbor-assistant",
        repositoryFullName: "acme/harbor-assistant",
        repositoryUrl: "https://github.com/acme/harbor-assistant.git",
        defaultBranch: "main",
        visibility: "private",
        workspaceState: "unprovisioned",
      },
    })
  })

  it("rejects repository binding when creating a rootPath project", async () => {
    const installationRepository = new InMemoryGitHubInstallationRepository()
    await installationRepository.save({
      id: "12345",
      accountType: "organization",
      accountLogin: "acme",
      targetType: "selected",
      status: "active",
      installedByUserId: "user-1",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      lastValidatedAt: null,
    })

    const app = await createApp({
      installationRepository,
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: {
        id: "project-1",
        name: "Harbor Assistant",
        source: {
          type: "rootPath",
          rootPath: "/tmp/harbor-assistant",
        },
        repositoryBinding: {
          provider: "github",
          installationId: "12345",
          repositoryFullName: "acme/harbor-assistant",
        },
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_REQUEST_BODY",
      },
    })
  })

  it("does not leave a git project behind when the referenced installation is missing", async () => {
    const projectRepository = new InMemoryProjectRepository()
    const app = await createApp({
      projectRepository,
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
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

    expect(response.statusCode).toBe(404)
    await expect(projectRepository.findById("project-1")).resolves.toBeNull()
  })

  it("does not leave a git project behind when the repository is outside installation scope", async () => {
    const projectRepository = new InMemoryProjectRepository()
    const installationRepository = new InMemoryGitHubInstallationRepository()
    await installationRepository.save({
      id: "12345",
      accountType: "organization",
      accountLogin: "acme",
      targetType: "selected",
      status: "active",
      installedByUserId: "user-1",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      lastValidatedAt: null,
    })
    const app = await createApp({
      projectRepository,
      installationRepository,
      githubAppClient: createGitHubAppClientStub({
        listInstallationRepositories: vi.fn(async () => []),
      }),
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
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

    expect(response.statusCode).toBe(404)
    await expect(projectRepository.findById("project-1")).resolves.toBeNull()
  })

  it("rolls the project back when saving the repository binding fails", async () => {
    const projectRepository = new InMemoryProjectRepository()
    const installationRepository = new InMemoryGitHubInstallationRepository()
    await installationRepository.save({
      id: "12345",
      accountType: "organization",
      accountLogin: "acme",
      targetType: "selected",
      status: "active",
      installedByUserId: "user-1",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      lastValidatedAt: null,
    })
    class FailingBindingRepository extends InMemoryProjectRepositoryBindingRepository {
      override async save(): Promise<void> {
        throw new Error("binding write failed")
      }
    }

    const app = await createApp({
      projectRepository,
      installationRepository,
      bindingRepository: new FailingBindingRepository(),
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects",
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

    expect(response.statusCode).toBe(500)
    await expect(projectRepository.findById("project-1")).resolves.toBeNull()
  })

  it("provisions a local workspace for a bound git project", async () => {
    const installationRepository = new InMemoryGitHubInstallationRepository()
    await installationRepository.save({
      id: "12345",
      accountType: "organization",
      accountLogin: "acme",
      targetType: "selected",
      status: "active",
      installedByUserId: "user-1",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      lastValidatedAt: null,
    })
    const workspaceManager = createWorkspaceManagerStub()

    const app = await createApp({
      installationRepository,
      workspaceManager,
    })

    await app.inject({
      method: "POST",
      url: "/v1/projects",
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

    const provisioned = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/provision-workspace",
    })

    expect(provisioned.statusCode).toBe(200)
    expect(workspaceManager.cloneRepository).toHaveBeenCalledWith({
      repositoryUrl: "https://github.com/acme/harbor-assistant.git",
      branch: "main",
      targetPath: "/managed-workspaces/user-1/project-1",
      accessToken: "installation-token",
    })
    expect(provisioned.json()).toMatchObject({
      ok: true,
      project: {
        id: "project-1",
        rootPath: "/managed-workspaces/user-1/project-1",
        normalizedPath: "/managed-workspaces/user-1/project-1",
      },
      repositoryBinding: {
        workspaceState: "ready",
      },
    })
  })

  it("rejects sync when the git project has not been provisioned yet", async () => {
    const installationRepository = new InMemoryGitHubInstallationRepository()
    await installationRepository.save({
      id: "12345",
      accountType: "organization",
      accountLogin: "acme",
      targetType: "selected",
      status: "active",
      installedByUserId: "user-1",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      lastValidatedAt: null,
    })

    const app = await createApp({
      installationRepository,
    })

    await app.inject({
      method: "POST",
      url: "/v1/projects",
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

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/project-1/sync",
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_PROJECT_STATE",
      },
    })
  })
})
