import type { PrismaClient } from "@prisma/client"
import Fastify from "fastify"
import { afterEach, describe, expect, it } from "vitest"

import type { ServiceConfig } from "../../../config"
import { ERROR_CODES } from "../../../constants/errors"
import errorHandlerPlugin from "../../../plugins/error-handler"
import { registerAuthModuleRoutes } from "./index"
import authSessionPlugin from "../plugin/auth-session"
import { createTestDatabase, type TestDatabase } from "../../../../test/helpers/test-database"
import {
  PrismaWorkspaceInvitationRepository,
  PrismaWorkspaceRepository,
} from "../../workspace"
import {
  GITHUB_OAUTH_REDIRECT_COOKIE_NAME,
  HARBOR_SESSION_COOKIE_NAME,
} from "../constants"
import { PrismaAuthSessionStore } from "../infrastructure/prisma-auth-session-store"

function createAuthTestConfig(): ServiceConfig {
  return {
    port: 3400,
    host: "127.0.0.1",
    serviceName: "harbor-test",
    database: "file:test.sqlite",
    fileBrowserRootDirectory: "/tmp",
    projectLocalPathRootDirectory: "/tmp/workspaces",
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
    sessionCookieDomain: undefined,
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
        includeOrganizations?: boolean
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

function extractCookieValue(headers: Record<string, unknown>, name: string) {
  const cookie = extractCookie(headers, name)
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
    const authorizeUrl = new URL(String(response.headers.location))
    expect(authorizeUrl.searchParams.get("scope")).toBe("read:user user:email")
    expect(extractCookie(response.headers, "harbor_github_oauth_state")).toContain(
      "Max-Age=600",
    )

    await app.close()
  })

  it("adds read:org to the OAuth scope when org allowlist is configured", async () => {
    testDatabase = await createTestDatabase()
    const app = await createAuthTestApp(testDatabase.prisma, {
      config: {
        ...createAuthTestConfig(),
        allowedGitHubOrgs: ["harbor"],
      },
    })

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/github/start",
    })

    expect(response.statusCode).toBe(302)
    const authorizeUrl = new URL(String(response.headers.location))
    expect(authorizeUrl.searchParams.get("scope")).toBe(
      "read:user user:email read:org",
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

  it("restores a validated redirect target after a successful GitHub callback", async () => {
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
      url: "/v1/auth/github/start?redirect=%2Fprojects%2Fproject-1%3Ftab%3Dfiles%23readme",
    })

    const state = extractCookieValue(start.headers, "harbor_github_oauth_state")
    expect(state).toBeTruthy()
    expect(
      extractCookie(start.headers, GITHUB_OAUTH_REDIRECT_COOKIE_NAME),
    ).toContain(
      "harbor_github_oauth_redirect=%2Fprojects%2Fproject-1%3Ftab%3Dfiles%23readme",
    )

    const callback = await app.inject({
      method: "GET",
      url: `/v1/auth/github/callback?code=test-code&state=${state}`,
      headers: {
        cookie: buildCookieHeader(start.headers, [
          "harbor_github_oauth_state",
          GITHUB_OAUTH_REDIRECT_COOKIE_NAME,
        ]),
      },
    })

    expect(callback.statusCode).toBe(302)
    expect(callback.headers.location).toBe(
      "http://127.0.0.1:3000/projects/project-1?tab=files#readme",
    )
    expect(
      extractCookie(callback.headers, GITHUB_OAUTH_REDIRECT_COOKIE_NAME),
    ).toContain("Max-Age=0")

    await app.close()
  })

  it("falls back to the default web URL when the requested redirect is invalid", async () => {
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
      url: "/v1/auth/github/start?redirect=https%3A%2F%2Fevil.example%2Fsteal",
    })

    expect(
      extractCookie(start.headers, GITHUB_OAUTH_REDIRECT_COOKIE_NAME),
    ).toContain("Max-Age=0")

    const state = extractCookieValue(start.headers, "harbor_github_oauth_state")
    const callback = await app.inject({
      method: "GET",
      url: `/v1/auth/github/callback?code=test-code&state=${state}`,
      headers: {
        cookie: buildCookieHeader(start.headers, ["harbor_github_oauth_state"]),
      },
    })

    expect(callback.statusCode).toBe(302)
    expect(callback.headers.location).toBe("http://127.0.0.1:3000/app")

    await app.close()
  })

  it("preserves the redirect target when the callback fails and returns to the login page", async () => {
    testDatabase = await createTestDatabase()
    const app = await createAuthTestApp(testDatabase.prisma, {
      githubClient: {
        async exchangeCodeForIdentity() {
          throw new Error("boom")
        },
      },
    })

    const start = await app.inject({
      method: "GET",
      url: "/v1/auth/github/start?redirect=%2Fprojects%2Fproject-1",
    })

    const state = extractCookieValue(start.headers, "harbor_github_oauth_state")
    const callback = await app.inject({
      method: "GET",
      url: `/v1/auth/github/callback?code=test-code&state=${state}`,
      headers: {
        cookie: buildCookieHeader(start.headers, [
          "harbor_github_oauth_state",
          GITHUB_OAUTH_REDIRECT_COOKIE_NAME,
        ]),
      },
    })

    expect(callback.statusCode).toBe(302)
    expect(callback.headers.location).toBe(
      "http://127.0.0.1:3000/login?error=AUTH_CALLBACK_FAILED&redirect=%2Fprojects%2Fproject-1",
    )

    await app.close()
  })

  it("redirects to the login page with a structured error when a GitHub login collides with an existing Harbor user", async () => {
    testDatabase = await createTestDatabase()
    await testDatabase.prisma.user.create({
      data: {
        githubLogin: "octocat-team",
      },
    })
    const app = await createAuthTestApp(testDatabase.prisma, {
      githubClient: {
        async exchangeCodeForIdentity() {
          return {
            providerUserId: "github-user-2",
            login: "octocat-team",
            name: "Octo Cat",
            email: "octo@example.com",
            avatarUrl: "https://avatars.example.com/u/1",
            organizations: [],
          }
        },
      },
    })

    const start = await app.inject({
      method: "GET",
      url: "/v1/auth/github/start?redirect=%2Fprojects%2Fproject-1",
    })

    const state = extractCookieValue(start.headers, "harbor_github_oauth_state")
    const callback = await app.inject({
      method: "GET",
      url: `/v1/auth/github/callback?code=test-code&state=${state}`,
      headers: {
        cookie: buildCookieHeader(start.headers, [
          "harbor_github_oauth_state",
          GITHUB_OAUTH_REDIRECT_COOKIE_NAME,
        ]),
      },
    })

    expect(callback.statusCode).toBe(302)
    expect(callback.headers.location).toBe(
      `http://127.0.0.1:3000/login?error=${ERROR_CODES.AUTH_IDENTITY_CONFLICT}&redirect=%2Fprojects%2Fproject-1`,
    )
    expect(extractCookie(callback.headers, HARBOR_SESSION_COOKIE_NAME)).toBeNull()

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
        cookie: buildCookieHeader(start.headers, ["harbor_github_oauth_state"]),
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

  it("sets the configured cookie domain on the Harbor session cookie", async () => {
    testDatabase = await createTestDatabase()
    const app = await createAuthTestApp(testDatabase.prisma, {
      config: {
        ...createAuthTestConfig(),
        sessionCookieDomain: ".example.com",
      },
      githubClient: {
        async exchangeCodeForIdentity() {
          return {
            providerUserId: "github-user-1",
            login: "octocat-team",
            name: "Octo Cat",
            email: "octo@example.com",
            avatarUrl: "https://avatars.example.com/u/1",
            organizations: [],
          }
        },
      },
    })

    const start = await app.inject({
      method: "GET",
      url: "/v1/auth/github/start",
    })
    const state = extractCookieValue(start.headers, "harbor_github_oauth_state")

    const callback = await app.inject({
      method: "GET",
      url: `/v1/auth/github/callback?code=test-code&state=${state}`,
      headers: {
        cookie: buildCookieHeader(start.headers, ["harbor_github_oauth_state"]),
      },
    })

    expect(callback.statusCode).toBe(302)
    expect(extractCookie(callback.headers, HARBOR_SESSION_COOKIE_NAME)).toContain(
      "Domain=example.com",
    )

    await app.close()
  })

  it("uses the configured cookie domain when clearing the Harbor session", async () => {
    testDatabase = await createTestDatabase()
    const app = await createAuthTestApp(testDatabase.prisma, {
      config: {
        ...createAuthTestConfig(),
        sessionCookieDomain: "example.com",
      },
    })
    const user = await testDatabase.prisma.user.create({
      data: {
        githubLogin: "octocat-team",
      },
    })
    const sessionStore = new PrismaAuthSessionStore(testDatabase.prisma)
    const sessionRecord = await sessionStore.createSession({
      userId: user.id,
      ttlDays: 30,
      userAgent: null,
      ip: null,
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: {
        cookie: `${HARBOR_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionRecord.token)}`,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(extractCookie(response.headers, HARBOR_SESSION_COOKIE_NAME)).toContain(
      "Domain=example.com",
    )

    await app.close()
  })

  it("creates a personal workspace during the first successful login callback", async () => {
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
            organizations: [],
          }
        },
      },
    })

    const start = await app.inject({
      method: "GET",
      url: "/v1/auth/github/start",
    })

    const state = extractCookieValue(start.headers, "harbor_github_oauth_state")
    const callback = await app.inject({
      method: "GET",
      url: `/v1/auth/github/callback?code=test-code&state=${state}`,
      headers: {
        cookie: buildCookieHeader(start.headers, ["harbor_github_oauth_state"]),
      },
    })

    expect(callback.statusCode).toBe(302)

    const user = await testDatabase.prisma.user.findUnique({
      where: {
        githubLogin: "octocat-team",
      },
    })
    expect(user).not.toBeNull()

    const workspaceRepository = new PrismaWorkspaceRepository(testDatabase.prisma)
    const personalWorkspace = await workspaceRepository.findPersonalByUserId(user!.id)

    expect(personalWorkspace).not.toBeNull()
    expect(personalWorkspace).toMatchObject({
      type: "personal",
      createdByUserId: user!.id,
    })

    await app.close()
  })

  it("accepts pending workspace invitations during the first successful login callback", async () => {
    testDatabase = await createTestDatabase()
    await testDatabase.prisma.user.create({
      data: {
        id: "owner-1",
        githubLogin: "owner",
      },
    })
    await testDatabase.prisma.workspace.create({
      data: {
        id: "ws-team",
        slug: "harbor-team",
        name: "Harbor Team",
        type: "team",
        status: "active",
        createdByUserId: "owner-1",
        memberships: {
          create: {
            userId: "owner-1",
            role: "owner",
            status: "active",
          },
        },
      },
    })
    await testDatabase.prisma.workspaceInvitation.create({
      data: {
        id: "invite-1",
        workspaceId: "ws-team",
        inviteeGithubLogin: "octocat-team",
        role: "member",
        status: "pending",
        invitedByUserId: "owner-1",
      },
    })
    const app = await createAuthTestApp(testDatabase.prisma, {
      githubClient: {
        async exchangeCodeForIdentity() {
          return {
            providerUserId: "github-user-1",
            login: "octocat-team",
            name: "Octo Cat",
            email: "octo@example.com",
            avatarUrl: "https://avatars.example.com/u/1",
            organizations: [],
          }
        },
      },
    })

    const start = await app.inject({
      method: "GET",
      url: "/v1/auth/github/start",
    })

    const state = extractCookieValue(start.headers, "harbor_github_oauth_state")
    const callback = await app.inject({
      method: "GET",
      url: `/v1/auth/github/callback?code=test-code&state=${state}`,
      headers: {
        cookie: buildCookieHeader(start.headers, ["harbor_github_oauth_state"]),
      },
    })

    expect(callback.statusCode).toBe(302)

    const user = await testDatabase.prisma.user.findUnique({
      where: {
        githubLogin: "octocat-team",
      },
    })
    expect(user).not.toBeNull()

    const workspaceRepository = new PrismaWorkspaceRepository(testDatabase.prisma)
    const teamWorkspace = await workspaceRepository.findById("ws-team")
    expect(
      teamWorkspace?.memberships.some(
        (membership) =>
          membership.userId === user!.id && membership.status === "active",
      ),
    ).toBe(true)

    const invitationRepository = new PrismaWorkspaceInvitationRepository(
      testDatabase.prisma,
    )
    const invitation = await invitationRepository.findById("invite-1")
    expect(invitation).toMatchObject({
      status: "accepted",
      acceptedByUserId: user!.id,
    })

    await app.close()
  })
})
