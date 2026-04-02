import type { FastifyInstance } from "fastify"

import type { ServiceConfig } from "../../../config"
import { ERROR_CODES } from "../../../constants/errors"
import { AppError } from "../../../lib/errors/app-error"
import { expireCookie, parseCookieHeader, serializeCookie } from "../lib/cookies"
import { createOAuthState } from "../lib/session"
import {
  DEFAULT_SESSION_TTL_DAYS,
  GITHUB_OAUTH_STATE_COOKIE_NAME,
  HARBOR_SESSION_COOKIE_NAME,
} from "../constants"
import {
  GitHubOAuthClient,
  type GitHubIdentity,
} from "../infrastructure/github-oauth-client"
import { PrismaAuthStore } from "../infrastructure/prisma-auth-store"
import { requireAuthenticatedRequest } from "../plugin/auth-session"

function isSecureCookie(config: ServiceConfig) {
  return config.isProduction
}

function ensureGitHubOAuthConfigured(config: ServiceConfig) {
  if (!config.githubClientId || !config.githubClientSecret) {
    throw new AppError(
      ERROR_CODES.AUTH_NOT_CONFIGURED,
      503,
      "GitHub OAuth is not configured.",
    )
  }
}

function buildApiBaseUrl(config: ServiceConfig, request: { protocol: string; headers: { host?: string } }) {
  if (config.appBaseUrl) {
    return config.appBaseUrl
  }

  const host = request.headers.host?.trim()
  if (!host) {
    throw new AppError(
      ERROR_CODES.AUTH_NOT_CONFIGURED,
      500,
      "Unable to determine service base URL for OAuth callback.",
    )
  }

  return `${request.protocol}://${host}`
}

function createGitHubAuthorizeUrl(args: {
  clientId: string
  redirectUri: string
  state: string
}) {
  const url = new URL("https://github.com/login/oauth/authorize")
  url.searchParams.set("client_id", args.clientId)
  url.searchParams.set("redirect_uri", args.redirectUri)
  url.searchParams.set("scope", "read:user user:email")
  url.searchParams.set("state", args.state)
  return url.toString()
}

function assertGitHubIdentityAllowed(
  config: ServiceConfig,
  identity: { login: string; organizations: string[] },
) {
  const allowedUsers = new Set(config.allowedGitHubUsers.map((value) => value.toLowerCase()))
  const allowedOrgs = new Set(config.allowedGitHubOrgs.map((value) => value.toLowerCase()))

  if (allowedUsers.size === 0 && allowedOrgs.size === 0) {
    return
  }

  if (allowedUsers.has(identity.login.toLowerCase())) {
    return
  }

  if (
    identity.organizations.some((organization) =>
      allowedOrgs.has(organization.toLowerCase()),
    )
  ) {
    return
  }

  throw new AppError(ERROR_CODES.PERMISSION_DENIED, 403, "GitHub account is not allowed.")
}

export async function registerAuthModuleRoutes(
  app: FastifyInstance,
  options: {
    config: ServiceConfig
    githubClient?: {
      exchangeCodeForIdentity(args: {
        code: string
        redirectUri: string
      }): Promise<GitHubIdentity>
    }
    authStore?: PrismaAuthStore
  },
) {
  const authStore = options.authStore ?? new PrismaAuthStore(app.prisma)

  app.get(
    "/auth/github/start",
    async (request, reply) => {
      ensureGitHubOAuthConfigured(options.config)

      const apiBaseUrl = buildApiBaseUrl(options.config, request)
      const redirectUri = new URL("/v1/auth/github/callback", apiBaseUrl).toString()
      const state = createOAuthState()
      const authorizeUrl = createGitHubAuthorizeUrl({
        clientId: options.config.githubClientId!,
        redirectUri,
        state,
      })

      reply.header(
        "set-cookie",
        serializeCookie(GITHUB_OAUTH_STATE_COOKIE_NAME, state, {
          secure: isSecureCookie(options.config),
          sameSite: "Lax",
          path: "/",
          maxAge: 10 * 60,
        }),
      )

      return reply.redirect(authorizeUrl)
    },
  )

  app.get<{
    Querystring: {
      code?: string
      state?: string
    }
  }>(
    "/auth/github/callback",
    async (request, reply) => {
      ensureGitHubOAuthConfigured(options.config)

      const code = request.query.code?.trim()
      const state = request.query.state?.trim()
      const cookies = parseCookieHeader(request.headers.cookie)
      const storedState = cookies.get(GITHUB_OAUTH_STATE_COOKIE_NAME)

      if (!code || !state || !storedState || state !== storedState) {
        throw new AppError(
          ERROR_CODES.AUTH_CALLBACK_FAILED,
          400,
          "GitHub OAuth callback state is invalid.",
        )
      }

      const apiBaseUrl = buildApiBaseUrl(options.config, request)
      const redirectUri = new URL("/v1/auth/github/callback", apiBaseUrl).toString()
      const githubClient =
        options.githubClient ??
        new GitHubOAuthClient({
          clientId: options.config.githubClientId!,
          clientSecret: options.config.githubClientSecret!,
        })

      const identity = await githubClient.exchangeCodeForIdentity({
        code,
        redirectUri,
      })
      assertGitHubIdentityAllowed(options.config, identity)

      const user = await authStore.upsertGitHubUser({
        providerUserId: identity.providerUserId,
        login: identity.login,
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
      })
      const session = await authStore.createSession({
        userId: user.id,
        ttlDays: DEFAULT_SESSION_TTL_DAYS,
        userAgent: request.headers["user-agent"] ?? null,
        ip: request.ip,
      })

      reply.header("set-cookie", [
        serializeCookie(HARBOR_SESSION_COOKIE_NAME, session.token, {
          secure: isSecureCookie(options.config),
          sameSite: "Lax",
          path: "/",
          maxAge: DEFAULT_SESSION_TTL_DAYS * 24 * 60 * 60,
        }),
        expireCookie(GITHUB_OAUTH_STATE_COOKIE_NAME, {
          secure: isSecureCookie(options.config),
          sameSite: "Lax",
          path: "/",
        }),
      ])

      return reply.redirect(options.config.webBaseUrl ?? "/")
    },
  )

  app.get(
    "/auth/session",
    {
      schema: {
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["ok", "authenticated", "user"],
            properties: {
              ok: { type: "boolean", const: true },
              authenticated: { type: "boolean" },
              user: {
                anyOf: [
                  {
                    type: "null",
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "id",
                      "githubLogin",
                      "name",
                      "email",
                      "avatarUrl",
                      "status",
                      "lastLoginAt",
                      "createdAt",
                      "updatedAt",
                    ],
                    properties: {
                      id: { type: "string" },
                      githubLogin: { type: "string" },
                      name: { type: ["string", "null"] },
                      email: { type: ["string", "null"] },
                      avatarUrl: { type: ["string", "null"] },
                      status: { type: "string", enum: ["active", "disabled"] },
                      lastLoginAt: { type: ["string", "null"], format: "date-time" },
                      createdAt: { type: "string", format: "date-time" },
                      updatedAt: { type: "string", format: "date-time" },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
    async (request) => {
      return {
        ok: true,
        authenticated: Boolean(request.auth),
        user: request.auth?.user ?? null,
      }
    },
  )

  app.post(
    "/auth/logout",
    async (request, reply) => {
      const auth = requireAuthenticatedRequest(request)
      const cookies = parseCookieHeader(request.headers.cookie)
      const token = cookies.get(HARBOR_SESSION_COOKIE_NAME)

      if (token) {
        await authStore.revokeSessionByToken(token)
      } else {
        await authStore.revokeSession(auth.sessionId)
      }

      reply.header(
        "set-cookie",
        expireCookie(HARBOR_SESSION_COOKIE_NAME, {
          secure: isSecureCookie(options.config),
          sameSite: "Lax",
          path: "/",
        }),
      )

      return {
        ok: true,
      }
    },
  )
}
