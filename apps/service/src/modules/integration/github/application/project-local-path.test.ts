import { describe, expect, it, vi } from "vitest"

import { createProject } from "../../../project/domain/project"
import { InMemoryProjectRepository } from "../../../project/infrastructure/in-memory-project-repository"
import { provisionProjectLocalPathUseCase } from "./provision-project-local-path"
import { syncProjectLocalPathUseCase } from "./sync-project-local-path"
import { InMemoryGitHubInstallationRepository } from "../infrastructure/in-memory-github-installation-repository"
import { InMemoryProjectRepositoryBindingRepository } from "../infrastructure/in-memory-project-repository-binding-repository"
import type { GitHubAppClient } from "./github-app-client"
import type { ProjectLocalPathManager } from "./project-local-path-manager"

function createGitHubAppClientStub(
  overrides: Partial<GitHubAppClient> = {},
): GitHubAppClient {
  return {
    buildInstallUrl: vi.fn(
      () => "https://github.com/apps/harbor/installations/new",
    ),
    getInstallation: vi.fn(),
    listInstallationRepositories: vi.fn(async () => []),
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

describe("project local path use cases", () => {
  it("provisions a local path for a bound git project and writes the resolved path back to the project", async () => {
    const projectRepository = new InMemoryProjectRepository()
    const installationRepository = new InMemoryGitHubInstallationRepository()
    const bindingRepository = new InMemoryProjectRepositoryBindingRepository()
    const githubAppClient = createGitHubAppClientStub()
    const localPathManager = createLocalPathManagerStub()

    await projectRepository.save(
      createProject({
        id: "project-1",
        ownerUserId: "user-1",
        workspaceId: "ws_1",
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
      installedByUserId: "user-1",
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

    const project = await provisionProjectLocalPathUseCase(
      {
        projectRepository,
        installationRepository,
        bindingRepository,
        githubAppClient,
        localPathManager,
        projectLocalPathRootDirectory: "/managed-workspaces",
      },
      {
        projectId: "project-1",
        actorUserId: "user-1",
      },
    )

    expect(localPathManager.cloneRepository).toHaveBeenCalledWith({
      repositoryUrl: "https://github.com/acme/harbor-assistant.git",
      branch: "main",
      targetPath: "/managed-workspaces/ws_1/project-1",
      accessToken: "installation-token",
    })
    expect(project.rootPath).toBe("/managed-workspaces/ws_1/project-1")
    expect(project.normalizedPath).toBe("/managed-workspaces/ws_1/project-1")
  })

  it("rejects sync for a git project that still has no local path", async () => {
    const projectRepository = new InMemoryProjectRepository()
    const installationRepository = new InMemoryGitHubInstallationRepository()
    const bindingRepository = new InMemoryProjectRepositoryBindingRepository()

    await projectRepository.save(
      createProject({
        id: "project-1",
        ownerUserId: "user-1",
        workspaceId: "ws_1",
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
      installedByUserId: "user-1",
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

    await expect(
      syncProjectLocalPathUseCase(
        {
          projectRepository,
          installationRepository,
          bindingRepository,
          githubAppClient: createGitHubAppClientStub(),
          localPathManager: createLocalPathManagerStub(),
        },
        {
          projectId: "project-1",
          actorUserId: "user-1",
        },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_STATE",
    })
  })
})
