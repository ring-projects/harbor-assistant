import type { FastifyInstance } from "fastify"

import type { ServiceConfig } from "../../../config"
import { ERROR_CODES } from "../../../constants/errors"
import { AppError } from "../../../lib/errors/app-error"
import {
  expireCookie,
  parseCookieHeader,
  serializeCookie,
} from "../../../lib/http/cookies"
import { PrismaUserIdentityRegistry } from "../../user"
import {
  bootstrapWorkspaceOnLogin,
  PrismaWorkspaceInvitationRepository,
  PrismaWorkspaceRepository,
} from "../../workspace"
import {
  DEFAULT_SESSION_TTL_DAYS,
  GITHUB_OAUTH_REDIRECT_COOKIE_NAME,
  GITHUB_OAUTH_STATE_COOKIE_NAME,
  HARBOR_SESSION_COOKIE_NAME,
} from "../constants"
import { PrismaAuthSessionStore } from "../infrastructure/prisma-auth-session-store"
import { buildSessionCookieOptions } from "../lib/session-cookie-options"
import { createOAuthState } from "../lib/session"
import {
  buildGitHubAuthorizeUrl,
  GitHubOAuthProvider,
  type GitHubIdentity,
} from "../providers/github"
import type {
  GitHubAuthCallbackQuery,
  GitHubAuthStartQuery,
} from "../schemas"
import {
  completeGitHubAuthRouteSchema,
  startGitHubAuthRouteSchema,
} from "../schemas"

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

export async function registerGitHubAuthRoutes(
  app: FastifyInstance,
  options: {
    config: ServiceConfig
    sessionStore: PrismaAuthSessionStore
    userIdentityRegistry: PrismaUserIdentityRegistry
    githubProvider?: {
      buildAuthorizeUrl(args: {
        redirectUri: string
        state: string
        scopes: string[]
      }): string
      exchangeCodeForIdentity(args: {
        code: string
        redirectUri: string
        includeOrganizations?: boolean
      }): Promise<GitHubIdentity>
    }
    githubClient?: {
      exchangeCodeForIdentity(args: {
        code: string
        redirectUri: string
        includeOrganizations?: boolean
      }): Promise<GitHubIdentity>
    }
  },
) {
  const workspaceRepository = new PrismaWorkspaceRepository(app.prisma)
  const workspaceInvitationRepository =
    new PrismaWorkspaceInvitationRepository(app.prisma)
  const githubProvider =
    options.githubProvider ??
    (options.githubClient
      ? {
          buildAuthorizeUrl(args: {
            redirectUri: string
            state: string
            scopes: string[]
          }) {
            return buildGitHubAuthorizeUrl({
              clientId: options.config.githubClientId!,
              redirectUri: args.redirectUri,
              state: args.state,
              scopes: args.scopes,
            })
          },
          exchangeCodeForIdentity: options.githubClient.exchangeCodeForIdentity,
        }
      : new GitHubOAuthProvider({
          clientId: options.config.githubClientId!,
          clientSecret: options.config.githubClientSecret!,
        }))

  app.get<{ Querystring: GitHubAuthStartQuery }>(
    "/auth/github/start",
    {
      schema: startGitHubAuthRouteSchema,
    },
    async (request, reply) => {
      ensureGitHubOAuthConfigured(options.config)

      const redirectUri = new URL(
        "/v1/auth/github/callback",
        options.config.appBaseUrl,
      ).toString()
      const state = createOAuthState()
      const redirectTarget = normalizeLoginRedirectTarget(request.query.redirect)
      const authorizeUrl = githubProvider.buildAuthorizeUrl({
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

  app.get<{ Querystring: GitHubAuthCallbackQuery }>(
    "/auth/github/callback",
    {
      schema: completeGitHubAuthRouteSchema,
    },
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

        const identity = await githubProvider.exchangeCodeForIdentity({
          code,
          redirectUri,
          includeOrganizations: options.config.allowedGitHubOrgs.length > 0,
        })
        assertGitHubIdentityAllowed(options.config, identity)

        const user = await options.userIdentityRegistry.upsertGitHubUser({
          providerUserId: identity.providerUserId,
          login: identity.login,
          email: identity.email,
          name: identity.name,
          avatarUrl: identity.avatarUrl,
        })
        await bootstrapWorkspaceOnLogin(
          {
            workspaceRepository,
            invitationRepository: workspaceInvitationRepository,
          },
          {
            userId: user.id,
            githubLogin: user.githubLogin,
            fallbackName: user.name?.trim() || user.githubLogin,
          },
        )
        const session = await options.sessionStore.createSession({
          userId: user.id,
          ttlDays: DEFAULT_SESSION_TTL_DAYS,
          userAgent: request.headers["user-agent"] ?? null,
          ip: request.ip,
        })

        reply.header("set-cookie", [
          serializeCookie(HARBOR_SESSION_COOKIE_NAME, session.token, {
            ...buildSessionCookieOptions(options.config),
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
}
