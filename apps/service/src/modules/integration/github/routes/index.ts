import type { FastifyInstance, FastifyReply } from "fastify"
import { randomBytes } from "node:crypto"

import { AppError } from "../../../../lib/errors/app-error"
import { ERROR_CODES } from "../../../../constants/errors"
import {
  type AuthenticatedRequestContext,
  requireUserAuthenticatedRequest,
} from "../../../auth"
import type { GitHubAppClient } from "../application/github-app-client"
import type { GitHubInstallationRepository } from "../application/github-installation-repository"
import type { WorkspaceInstallationRepository } from "../application/workspace-installation-repository"
import { GITHUB_APP_INSTALL_STATE_COOKIE_NAME } from "../constants"
import {
  findWorkspaceAccessibleToUser,
  type WorkspaceRepository,
} from "../../../workspace"
import type {
  GitHubInstallationRepositoriesParams,
  GitHubInstallationsQuery,
  GitHubInstallUrlQuery,
  GitHubSetupQuery,
} from "../schemas"
import {
  completeGitHubSetupRouteSchema,
  getGitHubInstallUrlRouteSchema,
  listGitHubInstallationRepositoriesRouteSchema,
  listGitHubInstallationsRouteSchema,
} from "../schemas"

function resolveCurrentUserId(request: {
  auth: AuthenticatedRequestContext | null
}) {
  return requireUserAuthenticatedRequest(request).userId
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
  workspaceId: string | null
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
      workspaceId?: unknown
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
      workspaceId:
        typeof parsed.workspaceId === "string" && parsed.workspaceId.trim()
          ? parsed.workspaceId
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

async function assertWorkspaceMember(args: {
  workspaceRepository: WorkspaceRepository
  workspaceId: string
  userId: string
}) {
  const workspace = await findWorkspaceAccessibleToUser(
    args.workspaceRepository,
    {
      workspaceId: args.workspaceId,
      userId: args.userId,
    },
  )
  if (!workspace) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      403,
      "Workspace access denied.",
    )
  }

  return workspace
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
  reply: FastifyReply,
  config: {
    isProduction?: boolean
  },
) {
  reply.clearCookie(GITHUB_APP_INSTALL_STATE_COOKIE_NAME, {
    secure: isSecureCookie(config),
    sameSite: "lax",
    path: "/",
  })
}

export async function registerGitHubIntegrationRoutes(
  app: FastifyInstance,
  options: {
    config: {
      webBaseUrl?: string
      isProduction?: boolean
    }
    githubAppSlug?: string
    workspaceRepository: WorkspaceRepository
    workspaceInstallationRepository: WorkspaceInstallationRepository
    installationRepository: GitHubInstallationRepository
    githubAppClient: GitHubAppClient
  },
) {
  app.get<{ Querystring: GitHubInstallUrlQuery }>(
    "/integrations/github/app/install-url",
    {
      schema: getGitHubInstallUrlRouteSchema,
    },
    async (request, reply) => {
      ensureGitHubAppConfigured(options.githubAppSlug)
      const state = createGitHubAppInstallState()
      const returnTo = normalizeReturnTo(request.query.returnTo)
      const workspaceId = request.query.workspaceId?.trim() || null

      if (workspaceId) {
        await assertWorkspaceMember({
          workspaceRepository: options.workspaceRepository,
          workspaceId,
          userId: resolveCurrentUserId(request),
        })
      }

      reply.setCookie(
        GITHUB_APP_INSTALL_STATE_COOKIE_NAME,
        encodeInstallStateCookieValue({
          userId: resolveCurrentUserId(request),
          state,
          returnTo,
          workspaceId,
        }),
        {
          secure: isSecureCookie(options.config),
          sameSite: "lax",
          path: "/",
          maxAge: 10 * 60,
        },
      )

      return {
        ok: true,
        installUrl: options.githubAppClient.buildInstallUrl(state),
      }
    },
  )

  app.get<{ Querystring: GitHubSetupQuery }>(
    "/integrations/github/setup",
    {
      schema: completeGitHubSetupRouteSchema,
    },
    async (request, reply) => {
      ensureGitHubAppConfigured(options.githubAppSlug)
      const currentUserId = resolveCurrentUserId(request)
      const installState = decodeInstallStateCookieValue(
        request.cookies[GITHUB_APP_INSTALL_STATE_COOKIE_NAME],
      )
      const installationId = request.query.installation_id?.trim()
      const state = request.query.state?.trim()
      const returnTo = installState?.returnTo ?? null
      const workspaceId = installState?.workspaceId ?? null

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
        if (workspaceId) {
          await assertWorkspaceMember({
            workspaceRepository: options.workspaceRepository,
            workspaceId,
            userId: currentUserId,
          })
          await options.workspaceInstallationRepository.saveLink({
            workspaceId,
            installationId: installation.id,
            linkedByUserId: currentUserId,
            createdAt: now,
            updatedAt: now,
          })
        }

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
    },
  )

  app.get<{ Querystring: GitHubInstallationsQuery }>(
    "/integrations/github/installations",
    {
      schema: listGitHubInstallationsRouteSchema,
    },
    async (request) => {
      const workspaceId = request.query.workspaceId?.trim() || null
      let installations

      if (workspaceId) {
        await assertWorkspaceMember({
          workspaceRepository: options.workspaceRepository,
          workspaceId,
          userId: resolveCurrentUserId(request),
        })
        const links =
          await options.workspaceInstallationRepository.listLinksByWorkspaceId(
            workspaceId,
          )
        installations = (
          await Promise.all(
            links.map((link) =>
              options.installationRepository.findById(link.installationId),
            ),
          )
        ).filter((installation) => installation !== null)
      } else {
        installations =
          await options.installationRepository.listByInstalledByUserId(
            resolveCurrentUserId(request),
          )
      }

      return {
        ok: true,
        installations,
      }
    },
  )

  app.get<{
    Params: GitHubInstallationRepositoriesParams
    Querystring: GitHubInstallationsQuery
  }>(
    "/integrations/github/installations/:installationId/repositories",
    {
      schema: listGitHubInstallationRepositoriesRouteSchema,
    },
    async (request) => {
      const workspaceId = request.query.workspaceId?.trim() || null
      const installation = workspaceId
        ? await (async () => {
            await assertWorkspaceMember({
              workspaceRepository: options.workspaceRepository,
              workspaceId,
              userId: resolveCurrentUserId(request),
            })
            const link = await options.workspaceInstallationRepository.findLink(
              workspaceId,
              request.params.installationId,
            )
            if (!link) {
              return null
            }

            return options.installationRepository.findById(
              request.params.installationId,
            )
          })()
        : await options.installationRepository.findByIdAndInstalledByUserId(
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
