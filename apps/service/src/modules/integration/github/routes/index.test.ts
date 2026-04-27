import fastifyCookie from "@fastify/cookie"
import Fastify from "fastify"
import { describe, expect, it, vi } from "vitest"

import { registerGitHubIntegrationRoutes } from "."
import { ERROR_CODES } from "../../../../constants/errors"
import errorHandlerPlugin from "../../../../plugins/error-handler"
import { InMemoryGitHubInstallationRepository } from "../infrastructure/in-memory-github-installation-repository"
import { InMemoryWorkspaceInstallationRepository } from "../infrastructure/in-memory-workspace-installation-repository"
import type { GitHubAppClient } from "../application/github-app-client"
import { GITHUB_APP_INSTALL_STATE_COOKIE_NAME } from "../constants"
import { InMemoryWorkspaceRepository } from "../../../workspace"
import { createWorkspace } from "../../../workspace/domain/workspace"

async function createApp(args?: {
  installationRepository?: InMemoryGitHubInstallationRepository
  workspaceRepository?: InMemoryWorkspaceRepository
  workspaceInstallationRepository?: InMemoryWorkspaceInstallationRepository
  githubAppClient?: GitHubAppClient
  config?: {
    webBaseUrl?: string
    isProduction?: boolean
  }
}) {
  const installationRepository =
    args?.installationRepository ?? new InMemoryGitHubInstallationRepository()
  const workspaceRepository =
    args?.workspaceRepository ?? new InMemoryWorkspaceRepository()
  const workspaceInstallationRepository =
    args?.workspaceInstallationRepository ??
    new InMemoryWorkspaceInstallationRepository()
  const githubAppClient = args?.githubAppClient ?? createGitHubAppClientStub()
  const app = Fastify({ logger: false })

  app.decorateRequest("auth", null)
  app.addHook("onRequest", async (request) => {
    const userId = String(request.headers["x-user-id"] ?? "user-1")
    const githubLogin = String(request.headers["x-user-login"] ?? userId)
    request.auth = {
      sessionId: "session-1",
      userId,
      user: {
        id: userId,
        githubLogin,
        name: "User One",
        email: `${githubLogin}@example.com`,
        avatarUrl: null,
        status: "active",
        lastLoginAt: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    }
  })

  await app.register(errorHandlerPlugin)
  await app.register(fastifyCookie)
  await app.register(
    async (instance) => {
      await registerGitHubIntegrationRoutes(instance, {
        config: {
          webBaseUrl: "http://127.0.0.1:3000",
          ...args?.config,
        },
        githubAppSlug: "harbor-repository-access",
        workspaceRepository,
        workspaceInstallationRepository,
        installationRepository,
        githubAppClient,
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
    buildInstallUrl: vi.fn((state?: string) => {
      const url = new URL(
        "https://github.com/apps/harbor-repository-access/installations/new",
      )
      if (state) {
        url.searchParams.set("state", state)
      }
      return url.toString()
    }),
    getInstallation: vi.fn(async (installationId: string) => ({
      id: installationId,
      accountType: "organization" as const,
      accountLogin: "acme",
      targetType: "selected" as const,
      status: "active" as const,
    })),
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

function getSetCookieHeaders(headers: Record<string, unknown>) {
  const value = headers["set-cookie"]
  if (Array.isArray(value)) {
    return value.map(String)
  }
  return typeof value === "string" ? [value] : []
}

function extractCookieValue(headers: Record<string, unknown>, name: string) {
  const cookie = getSetCookieHeaders(headers).find((header) =>
    header.startsWith(`${name}=`),
  )
  if (!cookie) {
    return null
  }

  const match = cookie.match(new RegExp(`^${name}=([^;]+)`))
  return match?.[1] ?? null
}

function buildCookieHeader(headers: Record<string, unknown>, names: string[]) {
  return names
    .map((name) => {
      const value = extractCookieValue(headers, name)
      return value ? `${name}=${value}` : null
    })
    .filter((value): value is string => value !== null)
    .join("; ")
}

describe("github integration routes", () => {
  it("returns a GitHub App install URL for the current Harbor deployment", async () => {
    const app = await createApp()

    const response = await app.inject({
      method: "GET",
      url: "/v1/integrations/github/app/install-url?returnTo=%2Fprojects%2Fnew",
    })

    expect(response.statusCode).toBe(200)
    const payload = response.json()
    expect(payload.ok).toBe(true)
    const installUrl = new URL(payload.installUrl)
    expect(installUrl.origin + installUrl.pathname).toBe(
      "https://github.com/apps/harbor-repository-access/installations/new",
    )
    expect(installUrl.searchParams.get("state")).toBeTruthy()
    expect(
      extractCookieValue(
        response.headers,
        GITHUB_APP_INSTALL_STATE_COOKIE_NAME,
      ),
    ).toBeTruthy()
  })

  it("accepts workspaceId in install-url and links the installation during setup", async () => {
    const workspaceRepository = new InMemoryWorkspaceRepository()
    const workspaceInstallationRepository =
      new InMemoryWorkspaceInstallationRepository()
    await workspaceRepository.save(
      createWorkspace({
        id: "ws-1",
        name: "Harbor Team",
        type: "team",
        createdByUserId: "user-1",
      }),
    )
    const app = await createApp({
      workspaceRepository,
      workspaceInstallationRepository,
    })

    const installUrlResponse = await app.inject({
      method: "GET",
      url: "/v1/integrations/github/app/install-url?workspaceId=ws-1",
    })
    const installUrl = new URL(installUrlResponse.json().installUrl)

    const response = await app.inject({
      method: "GET",
      url: `/v1/integrations/github/setup?installation_id=12345&setup_action=install&state=${installUrl.searchParams.get("state")}`,
      headers: {
        cookie: buildCookieHeader(installUrlResponse.headers, [
          GITHUB_APP_INSTALL_STATE_COOKIE_NAME,
        ]),
      },
    })

    expect(response.statusCode).toBe(302)
    await expect(
      workspaceInstallationRepository.findLink("ws-1", "12345"),
    ).resolves.toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        installationId: "12345",
        linkedByUserId: "user-1",
      }),
    )
  })

  it("marks the install state cookie as secure in production", async () => {
    const app = await createApp({
      config: {
        isProduction: true,
      },
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/integrations/github/app/install-url",
    })

    expect(response.statusCode).toBe(200)
    expect(getSetCookieHeaders(response.headers)[0]).toContain("Secure")
  })

  it("records a GitHub App installation through the setup callback flow", async () => {
    const installationRepository = new InMemoryGitHubInstallationRepository()
    const app = await createApp({
      installationRepository,
    })
    const installUrlResponse = await app.inject({
      method: "GET",
      url: "/v1/integrations/github/app/install-url?returnTo=%2Fprojects%2Fnew",
    })
    const installUrl = new URL(installUrlResponse.json().installUrl)

    const response = await app.inject({
      method: "GET",
      url: `/v1/integrations/github/setup?installation_id=12345&setup_action=install&state=${installUrl.searchParams.get("state")}`,
      headers: {
        cookie: buildCookieHeader(installUrlResponse.headers, [
          GITHUB_APP_INSTALL_STATE_COOKIE_NAME,
        ]),
      },
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(
      "http://127.0.0.1:3000/github/app/callback?status=success&returnTo=%2Fprojects%2Fnew",
    )

    await expect(
      installationRepository.findById("12345"),
    ).resolves.toMatchObject({
      id: "12345",
      accountLogin: "acme",
      installedByUserId: "user-1",
    })
  })

  it("rejects setup callbacks with an invalid install state", async () => {
    const app = await createApp()

    const response = await app.inject({
      method: "GET",
      url: "/v1/integrations/github/setup?installation_id=12345&setup_action=install&state=bad-state",
    })

    expect(response.statusCode).toBe(302)
    const callbackUrl = new URL(String(response.headers.location))
    expect(callbackUrl.origin + callbackUrl.pathname).toBe(
      "http://127.0.0.1:3000/github/app/callback",
    )
    expect(callbackUrl.searchParams.get("status")).toBe("error")
    expect(callbackUrl.searchParams.get("code")).toBe(
      ERROR_CODES.PERMISSION_DENIED,
    )
    expect(callbackUrl.searchParams.get("message")).toBe(
      "GitHub App setup state is invalid.",
    )
  })

  it("rejects claiming an installation that is already linked to another Harbor user", async () => {
    const installationRepository = new InMemoryGitHubInstallationRepository()
    await installationRepository.save({
      id: "12345",
      accountType: "organization",
      accountLogin: "acme",
      targetType: "selected",
      status: "active",
      installedByUserId: "user-2",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      lastValidatedAt: null,
    })
    const app = await createApp({
      installationRepository,
    })
    const installUrlResponse = await app.inject({
      method: "GET",
      url: "/v1/integrations/github/app/install-url?returnTo=%2Fprojects%2Fproject-1%2Fsettings",
    })
    const installUrl = new URL(installUrlResponse.json().installUrl)

    const response = await app.inject({
      method: "GET",
      url: `/v1/integrations/github/setup?installation_id=12345&setup_action=install&state=${installUrl.searchParams.get("state")}`,
      headers: {
        cookie: buildCookieHeader(installUrlResponse.headers, [
          GITHUB_APP_INSTALL_STATE_COOKIE_NAME,
        ]),
      },
    })

    expect(response.statusCode).toBe(302)
    const callbackUrl = new URL(String(response.headers.location))
    expect(callbackUrl.origin + callbackUrl.pathname).toBe(
      "http://127.0.0.1:3000/github/app/callback",
    )
    expect(callbackUrl.searchParams.get("status")).toBe("error")
    expect(callbackUrl.searchParams.get("returnTo")).toBe(
      "/projects/project-1/settings",
    )
    expect(callbackUrl.searchParams.get("code")).toBe(ERROR_CODES.CONFLICT)
    expect(callbackUrl.searchParams.get("message")).toBe(
      "GitHub installation is already linked to another Harbor user.",
    )
  })

  it("lists only installations owned by the current Harbor user", async () => {
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
    await installationRepository.save({
      id: "67890",
      accountType: "user",
      accountLogin: "someone-else",
      targetType: "selected",
      status: "active",
      installedByUserId: "user-2",
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      lastValidatedAt: null,
    })

    const app = await createApp({
      installationRepository,
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/integrations/github/installations",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      ok: true,
      installations: [
        expect.objectContaining({
          id: "12345",
          accountLogin: "acme",
        }),
      ],
    })
  })

  it("lists installations linked to a workspace for a workspace member", async () => {
    const installationRepository = new InMemoryGitHubInstallationRepository()
    const workspaceRepository = new InMemoryWorkspaceRepository()
    const workspaceInstallationRepository =
      new InMemoryWorkspaceInstallationRepository()

    const workspace = createWorkspace({
      id: "ws-1",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    await workspaceRepository.save({
      ...workspace,
      memberships: [
        ...workspace.memberships,
        {
          workspaceId: "ws-1",
          userId: "user-2",
          role: "member",
          status: "active",
          createdAt: new Date("2026-04-06T00:00:00.000Z"),
          updatedAt: new Date("2026-04-06T00:00:00.000Z"),
        },
      ],
    })
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
    await workspaceInstallationRepository.saveLink({
      workspaceId: "ws-1",
      installationId: "12345",
      linkedByUserId: "user-1",
      createdAt: new Date("2026-04-06T00:00:00.000Z"),
      updatedAt: new Date("2026-04-06T00:00:00.000Z"),
    })

    const app = await createApp({
      installationRepository,
      workspaceRepository,
      workspaceInstallationRepository,
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/integrations/github/installations?workspaceId=ws-1",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "user-2",
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      ok: true,
      installations: [
        expect.objectContaining({
          id: "12345",
          accountLogin: "acme",
        }),
      ],
    })
  })

  it("lists repositories for an installation that belongs to the current Harbor user", async () => {
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
      method: "GET",
      url: "/v1/integrations/github/installations/12345/repositories",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      ok: true,
      repositories: [
        {
          nodeId: "repo_1",
          owner: "acme",
          name: "harbor-assistant",
          fullName: "acme/harbor-assistant",
          url: "https://github.com/acme/harbor-assistant.git",
          defaultBranch: "main",
          visibility: "private",
        },
      ],
    })
  })

  it("lists repositories for an installation linked to the workspace", async () => {
    const installationRepository = new InMemoryGitHubInstallationRepository()
    const workspaceRepository = new InMemoryWorkspaceRepository()
    const workspaceInstallationRepository =
      new InMemoryWorkspaceInstallationRepository()

    const workspace = createWorkspace({
      id: "ws-1",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    await workspaceRepository.save({
      ...workspace,
      memberships: [
        ...workspace.memberships,
        {
          workspaceId: "ws-1",
          userId: "user-2",
          role: "member",
          status: "active",
          createdAt: new Date("2026-04-06T00:00:00.000Z"),
          updatedAt: new Date("2026-04-06T00:00:00.000Z"),
        },
      ],
    })
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
    await workspaceInstallationRepository.saveLink({
      workspaceId: "ws-1",
      installationId: "12345",
      linkedByUserId: "user-1",
      createdAt: new Date("2026-04-06T00:00:00.000Z"),
      updatedAt: new Date("2026-04-06T00:00:00.000Z"),
    })

    const app = await createApp({
      installationRepository,
      workspaceRepository,
      workspaceInstallationRepository,
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/integrations/github/installations/12345/repositories?workspaceId=ws-1",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "user-2",
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      ok: true,
      repositories: [
        expect.objectContaining({
          fullName: "acme/harbor-assistant",
        }),
      ],
    })
  })
})
