import Fastify from "fastify"
import { describe, expect, it, vi } from "vitest"

import { registerGitHubIntegrationRoutes } from "."
import { ERROR_CODES } from "../../../../constants/errors"
import errorHandlerPlugin from "../../../../plugins/error-handler"
import { InMemoryGitHubInstallationRepository } from "../infrastructure/in-memory-github-installation-repository"
import type { GitHubAppClient } from "../application/github-app-client"
import { GITHUB_APP_INSTALL_STATE_COOKIE_NAME } from "../constants"

async function createApp(args?: {
  installationRepository?: InMemoryGitHubInstallationRepository
  githubAppClient?: GitHubAppClient
  config?: {
    webBaseUrl?: string
    isProduction?: boolean
  }
}) {
  const installationRepository =
    args?.installationRepository ?? new InMemoryGitHubInstallationRepository()
  const githubAppClient = args?.githubAppClient ?? createGitHubAppClientStub()
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
      await registerGitHubIntegrationRoutes(instance, {
        config: {
          webBaseUrl: "http://127.0.0.1:3000",
          ...args?.config,
        },
        githubAppSlug: "harbor-repository-access",
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
      url: "/v1/integrations/github/app/install-url",
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
      extractCookieValue(response.headers, GITHUB_APP_INSTALL_STATE_COOKIE_NAME),
    ).toBeTruthy()
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
      url: "/v1/integrations/github/app/install-url",
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
    expect(response.headers.location).toBe("http://127.0.0.1:3000")

    await expect(installationRepository.findById("12345")).resolves.toMatchObject({
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

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: ERROR_CODES.PERMISSION_DENIED,
      },
    })
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
      url: "/v1/integrations/github/app/install-url",
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

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {
        code: ERROR_CODES.CONFLICT,
      },
    })
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
})
