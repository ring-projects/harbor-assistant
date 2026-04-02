import type { FastifyInstance } from "fastify"

import { AppError } from "../../../../lib/errors/app-error"
import { ERROR_CODES } from "../../../../constants/errors"
import type { GitHubAppClient } from "../application/github-app-client"
import type { GitHubInstallationRepository } from "../application/github-installation-repository"

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

export async function registerGitHubIntegrationRoutes(
  app: FastifyInstance,
  options: {
    config: {
      webBaseUrl?: string
    }
    githubAppSlug?: string
    installationRepository: GitHubInstallationRepository
    githubAppClient: GitHubAppClient
  },
) {
  app.get("/integrations/github/app/install-url", async () => {
    ensureGitHubAppConfigured(options.githubAppSlug)

    return {
      ok: true,
      installUrl: options.githubAppClient.buildInstallUrl(),
    }
  })

  app.get<{
    Querystring: {
      installation_id?: string
      setup_action?: string
    }
  }>("/integrations/github/setup", async (request, reply) => {
    ensureGitHubAppConfigured(options.githubAppSlug)
    const installationId = request.query.installation_id?.trim()
    if (!installationId) {
      throw new AppError(
        ERROR_CODES.INVALID_REQUEST_BODY,
        400,
        "installation_id is required.",
      )
    }

    const installation = await options.githubAppClient.getInstallation(installationId)
    const now = new Date()
    await options.installationRepository.save({
      id: installation.id,
      accountType: installation.accountType,
      accountLogin: installation.accountLogin,
      targetType: installation.targetType,
      status: installation.status,
      installedByUserId: resolveCurrentUserId(request),
      createdAt: now,
      updatedAt: now,
      lastValidatedAt: now,
    })

    return reply.redirect(options.config.webBaseUrl ?? "/")
  })

  app.get("/integrations/github/installations", async (request) => {
    const installations = await options.installationRepository.listByInstalledByUserId(
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
  }>("/integrations/github/installations/:installationId/repositories", async (request) => {
    const installation =
      await options.installationRepository.findByIdAndInstalledByUserId(
        request.params.installationId,
        resolveCurrentUserId(request),
      )

    if (!installation) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, "GitHub installation not found.")
    }

    const repositories = await options.githubAppClient.listInstallationRepositories(
      installation.id,
    )

    return {
      ok: true,
      repositories,
    }
  })
}
