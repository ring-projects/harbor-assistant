import { afterEach, describe, expect, it, vi } from "vitest"

import {
  bindProjectRepository,
  createProject,
  provisionProjectWorkspace,
  readGitHubAppInstallUrl,
  readGitHubInstallations,
  readProjectRepositoryBinding,
  syncProjectWorkspace,
} from "./project-api-client"

const originalExecutorApiBaseUrl = process.env.VITE_EXECUTOR_API_BASE_URL

describe("project-api-client", () => {
  afterEach(() => {
    if (originalExecutorApiBaseUrl === undefined) {
      delete process.env.VITE_EXECUTOR_API_BASE_URL
    } else {
      process.env.VITE_EXECUTOR_API_BASE_URL = originalExecutorApiBaseUrl
    }

    vi.restoreAllMocks()
  })

  it("sends repository binding when creating a GitHub-backed git project", async () => {
    process.env.VITE_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        ok: true,
        project: {
          id: "project-1",
          slug: "harbor-assistant",
          name: "Harbor Assistant",
          description: null,
          source: {
            type: "git",
            repositoryUrl: "https://github.com/acme/harbor-assistant.git",
            branch: "main",
          },
          rootPath: null,
          normalizedPath: null,
          status: "active",
          archivedAt: null,
          lastOpenedAt: null,
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
          settings: {
            retention: {
              logRetentionDays: null,
              eventRetentionDays: null,
            },
            skills: {
              harborSkillsEnabled: true,
              harborSkillProfile: null,
            },
          },
        },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await createProject({
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
    })

    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
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
    })
  })

  it("reads GitHub installations using the integration contract", async () => {
    process.env.VITE_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          installations: [
            {
              id: "12345",
              accountType: "organization",
              accountLogin: "acme",
              targetType: "selected",
              status: "active",
            },
          ],
        }),
      }),
    )

    await expect(readGitHubInstallations()).resolves.toEqual([
      {
        id: "12345",
        accountType: "organization",
        accountLogin: "acme",
        targetType: "selected",
        status: "active",
      },
    ])
  })

  it("passes returnTo when requesting the GitHub App install URL", async () => {
    process.env.VITE_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        installUrl:
          "https://github.com/apps/harbor/installations/new?state=test-state",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      readGitHubAppInstallUrl("/projects/project-1/settings"),
    ).resolves.toBe(
      "https://github.com/apps/harbor/installations/new?state=test-state",
    )

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/v1/integrations/github/app/install-url?returnTo=%2Fprojects%2Fproject-1%2Fsettings",
    )
  })

  it("reads repository binding for a project", async () => {
    process.env.VITE_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
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
        }),
      }),
    )

    await expect(readProjectRepositoryBinding("project-1")).resolves.toEqual({
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
    })
  })

  it("binds repository access for an existing project", async () => {
    process.env.VITE_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
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
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      bindProjectRepository({
        projectId: "project-1",
        repositoryBinding: {
          provider: "github",
          installationId: "12345",
          repositoryFullName: "acme/harbor-assistant",
        },
      }),
    ).resolves.toMatchObject({
      projectId: "project-1",
      installationId: "12345",
      repositoryFullName: "acme/harbor-assistant",
    })

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PUT",
    })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      provider: "github",
      installationId: "12345",
      repositoryFullName: "acme/harbor-assistant",
    })
  })

  it("returns the updated project and binding after provisioning a workspace", async () => {
    process.env.VITE_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          project: {
            id: "project-1",
            slug: "harbor-assistant",
            name: "Harbor Assistant",
            description: null,
            source: {
              type: "git",
              repositoryUrl: "https://github.com/acme/harbor-assistant.git",
              branch: "main",
            },
            rootPath: "/managed-workspaces/user-1/project-1",
            normalizedPath: "/managed-workspaces/user-1/project-1",
            status: "active",
            archivedAt: null,
            lastOpenedAt: null,
            createdAt: "2026-04-02T00:00:00.000Z",
            updatedAt: "2026-04-02T00:00:00.000Z",
            settings: {
              retention: {
                logRetentionDays: null,
                eventRetentionDays: null,
              },
              skills: {
                harborSkillsEnabled: true,
                harborSkillProfile: null,
              },
            },
          },
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
            workspaceState: "ready",
          },
        }),
      }),
    )

    await expect(provisionProjectWorkspace("project-1")).resolves.toMatchObject(
      {
        project: {
          id: "project-1",
          rootPath: "/managed-workspaces/user-1/project-1",
        },
        repositoryBinding: {
          workspaceState: "ready",
        },
      },
    )
  })

  it("returns syncedAt after syncing a provisioned workspace", async () => {
    process.env.VITE_EXECUTOR_API_BASE_URL = "http://executor.example.com"

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          projectId: "project-1",
          syncedAt: "2026-04-02T03:00:00.000Z",
        }),
      }),
    )

    await expect(syncProjectWorkspace("project-1")).resolves.toEqual({
      projectId: "project-1",
      syncedAt: "2026-04-02T03:00:00.000Z",
    })
  })
})
