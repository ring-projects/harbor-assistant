import type { FastifyInstance } from "fastify"
import { randomBytes } from "node:crypto"

import { AppError } from "../../../../lib/errors/app-error"
import { ERROR_CODES } from "../../../../constants/errors"
import {
  expireCookie,
  parseCookieHeader,
  serializeCookie,
} from "../../../../lib/http/cookies"
import type { GitHubAppClient } from "../application/github-app-client"
import type { GitHubInstallationRepository } from "../application/github-installation-repository"
import { GITHUB_APP_INSTALL_STATE_COOKIE_NAME } from "../constants"

function resolveCurrentUserId(request: { auth: { userId: string } | null }) {
  return request.auth!.userId
}

function ensureGitHubAppConfigured(githubAppSlug: string | undefined) {
  if (!githubAppSlug?.trim()) {
    throw new AppError(
      ERROR_CODES.AUTH_NOT_CONFIGURED,
      503,
      "GitHub App is not configured.",
    )
  }
}

function isSecureCookie(config: { isProduction?: boolean }) {
  return config.isProduction === true
}

function createGitHubAppInstallState() {
  return randomBytes(24).toString("base64url")
}

function encodeInstallStateCookieValue(input: {
  userId: string
  state: string
  returnTo: string | null
}) {
  return JSON.stringify(input)
}

function decodeInstallStateCookieValue(value: string | undefined) {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as {
      userId?: unknown
      state?: unknown
      returnTo?: unknown
    }

    if (
      typeof parsed.userId !== "string" ||
      !parsed.userId.trim() ||
      typeof parsed.state !== "string" ||
      !parsed.state.trim()
    ) {
      return null
    }

    return {
      userId: parsed.userId,
      state: parsed.state,
      returnTo:
        typeof parsed.returnTo === "string" && parsed.returnTo.trim()
          ? parsed.returnTo
          : null,
    }
  } catch {
    return null
  }
}

function normalizeReturnTo(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST_BODY,
      400,
      "returnTo must be a relative application path.",
    )
  }

  return trimmed
}

function buildCallbackUrl(
  config: {
    webBaseUrl?: string
  },
  input: {
    status: "success" | "error"
    returnTo?: string | null
    code?: string
    message?: string
  },
) {
  const baseUrl = config.webBaseUrl?.trim()
  const isAbsoluteBase = Boolean(
    baseUrl && /^[a-z][a-z0-9+.-]*:\/\//i.test(baseUrl),
  )
  const resolvedBase = isAbsoluteBase
    ? (baseUrl as string)
    : `http://harbor.local${baseUrl?.startsWith("/") ? baseUrl : `/${baseUrl ?? ""}`}`
  const url = new URL(
    "github/app/callback",
    resolvedBase.endsWith("/") ? resolvedBase : `${resolvedBase}/`,
  )

  url.searchParams.set("status", input.status)
  if (input.returnTo) {
    url.searchParams.set("returnTo", input.returnTo)
  }
  if (input.code) {
    url.searchParams.set("code", input.code)
  }
  if (input.message) {
    url.searchParams.set("message", input.message)
  }

  return isAbsoluteBase
    ? url.toString()
    : `${url.pathname}${url.search}${url.hash}`
}

function clearInstallStateCookie(
  reply: {
    header(name: string, value: string): unknown
  },
  config: {
    isProduction?: boolean
  },
) {
  reply.header(
    "set-cookie",
    expireCookie(GITHUB_APP_INSTALL_STATE_COOKIE_NAME, {
      secure: isSecureCookie(config),
      sameSite: "Lax",
      path: "/",
    }),
  )
}

export async function registerGitHubIntegrationRoutes(
  app: FastifyInstance,
  options: {
    config: {
      webBaseUrl?: string
      isProduction?: boolean
    }
    githubAppSlug?: string
    installationRepository: GitHubInstallationRepository
    githubAppClient: GitHubAppClient
  },
) {
  app.get<{
    Querystring: {
      returnTo?: string
    }
  }>("/integrations/github/app/install-url", async (request, reply) => {
    ensureGitHubAppConfigured(options.githubAppSlug)
    const state = createGitHubAppInstallState()
    const returnTo = normalizeReturnTo(request.query.returnTo)

    reply.header(
      "set-cookie",
      serializeCookie(
        GITHUB_APP_INSTALL_STATE_COOKIE_NAME,
        encodeInstallStateCookieValue({
          userId: resolveCurrentUserId(request),
          state,
          returnTo,
        }),
        {
          secure: isSecureCookie(options.config),
          sameSite: "Lax",
          path: "/",
          maxAge: 10 * 60,
        },
      ),
    )

    return {
      ok: true,
      installUrl: options.githubAppClient.buildInstallUrl(state),
    }
  })

  app.get<{
    Querystring: {
      installation_id?: string
      setup_action?: string
      state?: string
    }
  }>("/integrations/github/setup", async (request, reply) => {
    ensureGitHubAppConfigured(options.githubAppSlug)
    const currentUserId = resolveCurrentUserId(request)
    const cookies = parseCookieHeader(request.headers.cookie)
    const installState = decodeInstallStateCookieValue(
      cookies.get(GITHUB_APP_INSTALL_STATE_COOKIE_NAME),
    )
    const installationId = request.query.installation_id?.trim()
    const state = request.query.state?.trim()
    const returnTo = installState?.returnTo ?? null

    if (
      !installState ||
      !state ||
      installState.state !== state ||
      installState.userId !== currentUserId
    ) {
      clearInstallStateCookie(reply, options.config)
      return reply.redirect(
        buildCallbackUrl(options.config, {
          status: "error",
          returnTo,
          code: ERROR_CODES.PERMISSION_DENIED,
          message: "GitHub App setup state is invalid.",
        }),
      )
    }

    if (!installationId) {
      clearInstallStateCookie(reply, options.config)
      return reply.redirect(
        buildCallbackUrl(options.config, {
          status: "error",
          returnTo,
          code: ERROR_CODES.INVALID_REQUEST_BODY,
          message: "installation_id is required.",
        }),
      )
    }

    try {
      const existingInstallation =
        await options.installationRepository.findById(installationId)
      if (
        existingInstallation?.installedByUserId &&
        existingInstallation.installedByUserId !== currentUserId
      ) {
        throw new AppError(
          ERROR_CODES.CONFLICT,
          409,
          "GitHub installation is already linked to another Harbor user.",
        )
      }

      const installation =
        await options.githubAppClient.getInstallation(installationId)
      const now = new Date()
      await options.installationRepository.save({
        id: installation.id,
        accountType: installation.accountType,
        accountLogin: installation.accountLogin,
        targetType: installation.targetType,
        status: installation.status,
        installedByUserId: currentUserId,
        createdAt: now,
        updatedAt: now,
        lastValidatedAt: now,
      })

      clearInstallStateCookie(reply, options.config)
      return reply.redirect(
        buildCallbackUrl(options.config, {
          status: "success",
          returnTo,
        }),
      )
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
              ERROR_CODES.INTERNAL_ERROR,
              500,
              "Unexpected service error.",
            )

      if (appError.statusCode >= 500) {
        request.log.error({ err: error }, appError.message)
      } else {
        request.log.warn({ err: error }, appError.message)
      }

      clearInstallStateCookie(reply, options.config)
      return reply.redirect(
        buildCallbackUrl(options.config, {
          status: "error",
          returnTo,
          code: appError.code,
          message: appError.message,
        }),
      )
    }
  })

  app.get("/integrations/github/installations", async (request) => {
    const installations =
      await options.installationRepository.listByInstalledByUserId(
        resolveCurrentUserId(request),
      )

    return {
      ok: true,
      installations,
    }
  })

  app.get<{
    Params: {
      installationId: string
    }
  }>(
    "/integrations/github/installations/:installationId/repositories",
    async (request) => {
      const installation =
        await options.installationRepository.findByIdAndInstalledByUserId(
          request.params.installationId,
          resolveCurrentUserId(request),
        )

      if (!installation) {
        throw new AppError(
          ERROR_CODES.NOT_FOUND,
          404,
          "GitHub installation not found.",
        )
      }

      const repositories =
        await options.githubAppClient.listInstallationRepositories(
          installation.id,
        )

      return {
        ok: true,
        repositories,
      }
    },
  )
}
