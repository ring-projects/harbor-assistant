import type { PrismaClient } from "@prisma/client"
import Fastify from "fastify"
import { afterEach, describe, expect, it } from "vitest"

import type { ServiceConfig } from "../../../config"
import errorHandlerPlugin from "../../../plugins/error-handler"
import { registerAuthModuleRoutes } from "./index"
import authSessionPlugin from "../plugin/auth-session"
import { createTestDatabase, type TestDatabase } from "../../../../test/helpers/test-database"
import { HARBOR_SESSION_COOKIE_NAME } from "../constants"

function createAuthTestConfig(): ServiceConfig {
  return {
    port: 3400,
    host: "127.0.0.1",
    serviceName: "harbor-test",
    database: "file:test.sqlite",
    fileBrowserRootDirectory: "/tmp",
    workspaceRootDirectory: "/tmp/workspaces",
    publicSkillsRootDirectory: "/tmp/skills/profiles/default",
    nodeEnv: "test",
    isProduction: false,
    appBaseUrl: "http://127.0.0.1:3400",
    webBaseUrl: "http://127.0.0.1:3000/app",
    githubClientId: "github-client-id",
    githubClientSecret: "github-client-secret",
    githubAppSlug: undefined,
    githubAppId: undefined,
    githubAppPrivateKey: undefined,
    githubAppWebhookSecret: undefined,
    allowedGitHubUsers: [],
    allowedGitHubOrgs: [],
  }
}

async function createAuthTestApp(
  prisma: PrismaClient,
  options?: {
    config?: ServiceConfig
    githubClient?: {
      exchangeCodeForIdentity(args: {
        code: string
        redirectUri: string
      }): Promise<{
        providerUserId: string
        login: string
        name: string | null
        email: string | null
        avatarUrl: string | null
        organizations: string[]
      }>
    }
  },
) {
  const config = options?.config ?? createAuthTestConfig()
  const app = Fastify({
    logger: false,
  })

  app.decorate("prisma", prisma)
  await app.register(errorHandlerPlugin)
  await app.register(authSessionPlugin, {
    config,
  })
  await app.register(
    async (instance) => {
      await registerAuthModuleRoutes(instance, {
        config,
        githubClient: options?.githubClient,
      })
    },
    {
      prefix: "/v1",
    },
  )
  await app.ready()

  return app
}

function getSetCookieHeaders(headers: Record<string, unknown>) {
  const value = headers["set-cookie"]
  if (Array.isArray(value)) {
    return value.map(String)
  }
  return typeof value === "string" ? [value] : []
}

function extractCookie(headers: Record<string, unknown>, name: string) {
  return getSetCookieHeaders(headers).find((header) => header.startsWith(`${name}=`)) ?? null
}

describe("auth routes", () => {
  let testDatabase: TestDatabase | null = null

  afterEach(async () => {
    await testDatabase?.cleanup()
    testDatabase = null
  })

  it("returns an anonymous session payload when no user is logged in", async () => {
    testDatabase = await createTestDatabase()
    const app = await createAuthTestApp(testDatabase.prisma)

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      ok: true,
      authenticated: false,
      user: null,
    })

    await app.close()
  })

  it("starts the GitHub OAuth flow and stores a short-lived state cookie", async () => {
    testDatabase = await createTestDatabase()
    const app = await createAuthTestApp(testDatabase.prisma)

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/github/start",
      headers: {
        host: "127.0.0.1:3400",
      },
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toContain("https://github.com/login/oauth/authorize")
    expect(response.headers.location).toContain("client_id=github-client-id")
    expect(extractCookie(response.headers, "harbor_github_oauth_state")).toContain(
      "Max-Age=600",
    )

    await app.close()
  })

  it("uses the configured appBaseUrl for the GitHub OAuth callback", async () => {
    testDatabase = await createTestDatabase()
    const config = {
      ...createAuthTestConfig(),
      appBaseUrl: "https://service.example.com",
    }
    const app = await createAuthTestApp(testDatabase.prisma, {
      config,
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/github/start",
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toContain(
      "redirect_uri=https%3A%2F%2Fservice.example.com%2Fv1%2Fauth%2Fgithub%2Fcallback",
    )

    await app.close()
  })

  it("creates a Harbor session on successful GitHub callback", async () => {
    testDatabase = await createTestDatabase()
    const app = await createAuthTestApp(testDatabase.prisma, {
      githubClient: {
        async exchangeCodeForIdentity() {
          return {
            providerUserId: "github-user-1",
            login: "octocat-team",
            name: "Octo Cat",
            email: "octo@example.com",
            avatarUrl: "https://avatars.example.com/u/1",
            organizations: ["harbor"],
          }
        },
      },
    })

    const start = await app.inject({
      method: "GET",
      url: "/v1/auth/github/start",
      headers: {
        host: "127.0.0.1:3400",
      },
    })

    const stateCookie = extractCookie(start.headers, "harbor_github_oauth_state")
    expect(stateCookie).not.toBeNull()
    const stateMatch = stateCookie?.match(/^harbor_github_oauth_state=([^;]+)/)
    expect(stateMatch?.[1]).toBeTruthy()
    const callback = await app.inject({
      method: "GET",
      url: `/v1/auth/github/callback?code=test-code&state=${stateMatch?.[1]}`,
      headers: {
        cookie: stateCookie!,
        host: "127.0.0.1:3400",
      },
    })

    expect(callback.statusCode).toBe(302)
    expect(callback.headers.location).toBe("http://127.0.0.1:3000/app")

    const sessionCookie = extractCookie(callback.headers, HARBOR_SESSION_COOKIE_NAME)
    expect(sessionCookie).toContain(`${HARBOR_SESSION_COOKIE_NAME}=`)

    const session = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: {
        cookie: sessionCookie!,
      },
    })

    expect(session.statusCode).toBe(200)
    expect(session.json()).toMatchObject({
      ok: true,
      authenticated: true,
      user: {
        githubLogin: "octocat-team",
        email: "octo@example.com",
      },
    })

    await app.close()
  })
})
