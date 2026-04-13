import type { FastifyInstance } from "fastify"

import type { ServiceConfig } from "../../../config"
import { ERROR_CODES } from "../../../constants/errors"
import { AppError } from "../../../lib/errors/app-error"
import {
  expireCookie,
  parseCookieHeader,
  serializeCookie,
} from "../../../lib/http/cookies"
import { createOAuthState } from "../lib/session"
import {
  DEFAULT_SESSION_TTL_DAYS,
  GITHUB_OAUTH_REDIRECT_COOKIE_NAME,
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

function buildWebLoginRedirectUrl(config: ServiceConfig, errorCode: string) {
  const loginUrl = buildWebAbsoluteUrl(config, "/login")
  if (!loginUrl) {
    return null
  }

  const url = new URL(loginUrl)
  url.searchParams.set("error", errorCode)
  return url.toString()
}

function createGitHubAuthorizeUrl(args: {
  clientId: string
  redirectUri: string
  state: string
  scopes: string[]
}) {
  const url = new URL("https://github.com/login/oauth/authorize")
  url.searchParams.set("client_id", args.clientId)
  url.searchParams.set("redirect_uri", args.redirectUri)
  url.searchParams.set("scope", args.scopes.join(" "))
  url.searchParams.set("state", args.state)
  return url.toString()
}

function getGitHubOAuthScopes(config: ServiceConfig) {
  const scopes = ["read:user", "user:email"]

  if (config.allowedGitHubOrgs.length > 0) {
    scopes.push("read:org")
  }

  return scopes
}

function normalizeLoginRedirectTarget(value: string | null | undefined) {
  const candidate = value?.trim()

  if (!candidate) {
    return null
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return null
  }

  if (candidate.includes("\r") || candidate.includes("\n")) {
    return null
  }

  return candidate
}

function buildWebAbsoluteUrl(config: ServiceConfig, path: string) {
  if (!config.webBaseUrl) {
    return null
  }

  const webUrl = new URL(config.webBaseUrl)
  return new URL(path, `${webUrl.protocol}//${webUrl.host}/`).toString()
}

function buildWebSuccessRedirectUrl(
  config: ServiceConfig,
  redirectTarget: string | null,
) {
  if (redirectTarget) {
    const redirectUrl = buildWebAbsoluteUrl(config, redirectTarget)
    return redirectUrl ?? redirectTarget
  }

  return config.webBaseUrl ?? "/"
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
        includeOrganizations?: boolean
      }): Promise<GitHubIdentity>
    }
    authStore?: PrismaAuthStore
  },
) {
  const authStore = options.authStore ?? new PrismaAuthStore(app.prisma)

  app.get<{
    Querystring: {
      redirect?: string
    }
  }>(
    "/auth/github/start",
    async (request, reply) => {
      ensureGitHubOAuthConfigured(options.config)

      const redirectUri = new URL(
        "/v1/auth/github/callback",
        options.config.appBaseUrl,
      ).toString()
      const state = createOAuthState()
      const redirectTarget = normalizeLoginRedirectTarget(request.query.redirect)
      const authorizeUrl = createGitHubAuthorizeUrl({
        clientId: options.config.githubClientId!,
        redirectUri,
        state,
        scopes: getGitHubOAuthScopes(options.config),
      })

      reply.header("set-cookie", [
        serializeCookie(GITHUB_OAUTH_STATE_COOKIE_NAME, state, {
          secure: isSecureCookie(options.config),
          sameSite: "Lax",
          path: "/",
          maxAge: 10 * 60,
        }),
        redirectTarget
          ? serializeCookie(GITHUB_OAUTH_REDIRECT_COOKIE_NAME, redirectTarget, {
              secure: isSecureCookie(options.config),
              sameSite: "Lax",
              path: "/",
              maxAge: 10 * 60,
            })
          : expireCookie(GITHUB_OAUTH_REDIRECT_COOKIE_NAME, {
              secure: isSecureCookie(options.config),
              sameSite: "Lax",
              path: "/",
            }),
      ])

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
      const cookies = parseCookieHeader(request.headers.cookie)
      const storedRedirect = normalizeLoginRedirectTarget(
        cookies.get(GITHUB_OAUTH_REDIRECT_COOKIE_NAME),
      )

      try {
        ensureGitHubOAuthConfigured(options.config)

        const code = request.query.code?.trim()
        const state = request.query.state?.trim()
        const storedState = cookies.get(GITHUB_OAUTH_STATE_COOKIE_NAME)

        if (!code || !state || !storedState || state !== storedState) {
          throw new AppError(
            ERROR_CODES.AUTH_CALLBACK_FAILED,
            400,
            "GitHub OAuth callback state is invalid.",
          )
        }

        const redirectUri = new URL(
          "/v1/auth/github/callback",
          options.config.appBaseUrl,
        ).toString()
        const githubClient =
          options.githubClient ??
          new GitHubOAuthClient({
            clientId: options.config.githubClientId!,
            clientSecret: options.config.githubClientSecret!,
          })

        const identity = await githubClient.exchangeCodeForIdentity({
          code,
          redirectUri,
          includeOrganizations: options.config.allowedGitHubOrgs.length > 0,
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
          expireCookie(GITHUB_OAUTH_REDIRECT_COOKIE_NAME, {
            secure: isSecureCookie(options.config),
            sameSite: "Lax",
            path: "/",
          }),
        ])

        return reply.redirect(
          buildWebSuccessRedirectUrl(options.config, storedRedirect),
        )
      } catch (error) {
        const redirectUrl = buildWebLoginRedirectUrl(
          options.config,
          error instanceof AppError
            ? error.code
            : ERROR_CODES.AUTH_CALLBACK_FAILED,
        )

        if (redirectUrl) {
          const url = new URL(redirectUrl)
          if (storedRedirect) {
            url.searchParams.set("redirect", storedRedirect)
          }
          reply.header("set-cookie", [
            expireCookie(GITHUB_OAUTH_STATE_COOKIE_NAME, {
              secure: isSecureCookie(options.config),
              sameSite: "Lax",
              path: "/",
            }),
            expireCookie(GITHUB_OAUTH_REDIRECT_COOKIE_NAME, {
              secure: isSecureCookie(options.config),
              sameSite: "Lax",
              path: "/",
            }),
          ])
          return reply.redirect(url.toString())
        }

        throw error
      }
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
