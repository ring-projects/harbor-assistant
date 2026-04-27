import type { FastifyInstance } from "fastify"

import { AppError } from "../../../lib/errors/app-error"
import { ERROR_CODES } from "../../../constants/errors"
import { requireUserAuthenticatedRequest } from "../../auth"
import { ensureWorkspaceInstallationAccess } from "../../integration/github/application/ensure-workspace-installation-access"
import { createGitHubBoundProjectUseCase } from "../../integration/github/application/create-github-bound-project"
import { resolveWorkspaceForUser } from "../../workspace"
import { archiveProjectUseCase } from "../application/archive-project"
import { createProjectUseCase } from "../application/create-project"
import { deleteProjectUseCase } from "../application/delete-project"
import { getProjectUseCase } from "../application/get-project"
import { restoreProjectUseCase } from "../application/restore-project"
import { updateProjectUseCase } from "../application/update-project"
import { toProjectAppError } from "../project-app-error"
import type {
  CreateProjectBody,
  ProjectIdParams,
  UpdateProjectBody,
} from "../schemas"
import {
  archiveProjectRouteSchema,
  createProjectRouteSchema,
  deleteProjectRouteSchema,
  getProjectRouteSchema,
  listProjectsRouteSchema,
  restoreProjectRouteSchema,
  updateProjectRouteSchema,
} from "../schemas"
import type { ProjectModuleRouteOptions } from "./shared"
import {
  getAuthorizationActor,
  getOwnerUserId,
  requireRouteAuthorization,
  requireGitHubRepositoryAccess,
} from "./shared"

export async function registerProjectCoreRoutes(
  app: FastifyInstance,
  options: ProjectModuleRouteOptions,
) {
  const { repository, workspaceRepository, pathPolicy } = options

  app.get(
    "/projects",
    {
      schema: listProjectsRouteSchema,
    },
    async (request) => {
      try {
        const actor = getAuthorizationActor(request)
        const projects = await repository.list()
        const decisions = await Promise.all(
          projects.map((project) =>
            options.authorization.authorize({
              actor,
              action: "project.view",
              resource: {
                kind: "project",
                projectId: project.id,
              },
            }),
          ),
        )

        return {
          ok: true,
          projects: projects.filter(
            (_, index) => decisions[index]?.effect === "allow",
          ),
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.post<{ Body: CreateProjectBody }>(
    "/projects",
    {
      schema: createProjectRouteSchema,
    },
    async (request, reply) => {
      try {
        const auth = requireUserAuthenticatedRequest(request)
        const ownerUserId = getOwnerUserId(request)
        const actor = getAuthorizationActor(request)
        const workspace = await resolveWorkspaceForUser(workspaceRepository, {
          workspaceId: request.body.workspaceId,
          userId: ownerUserId,
          fallbackName: auth.user.name?.trim() || auth.user.githubLogin,
        })
        if (!workspace) {
          throw new AppError(
            ERROR_CODES.PERMISSION_DENIED,
            403,
            "Workspace access denied.",
          )
        }
        const workspaceId = workspace.id
        await requireRouteAuthorization(
          options.authorization,
          actor,
          "project.create",
          {
            kind: "workspace",
            workspaceId,
          },
        )
        const githubAccess =
          request.body.source.type === "git" && request.body.repositoryBinding
            ? requireGitHubRepositoryAccess(options)
            : null

        if (
          request.body.source.type === "rootPath" &&
          "repositoryBinding" in request.body &&
          request.body.repositoryBinding
        ) {
          throw new AppError(
            ERROR_CODES.INVALID_REQUEST_BODY,
            400,
            "repositoryBinding is only supported for git projects.",
          )
        }

        let project

        if (
          request.body.source.type === "git" &&
          request.body.repositoryBinding
        ) {
          if (!options.workspaceInstallationRepository) {
            throw new AppError(
              ERROR_CODES.AUTH_NOT_CONFIGURED,
              503,
              "Workspace GitHub installation access is not configured.",
            )
          }
          await ensureWorkspaceInstallationAccess(
            {
              installationRepository: githubAccess!.installationRepository,
              workspaceInstallationRepository:
                options.workspaceInstallationRepository,
            },
            {
              workspaceId,
              installationId: request.body.repositoryBinding.installationId,
              actorUserId: ownerUserId,
            },
          )
          project = (
            await createGitHubBoundProjectUseCase(
              {
                projectRepository: repository,
                pathPolicy,
                installationRepository: githubAccess!.installationRepository,
                bindingRepository: githubAccess!.repositoryBindingRepository,
                githubAppClient: githubAccess!.githubAppClient,
                workspaceInstallationRepository:
                  options.workspaceInstallationRepository,
              },
              {
                id: request.body.id,
                name: request.body.name,
                description: request.body.description,
                ownerUserId,
                workspaceId,
                source: request.body.source,
                repositoryBinding: {
                  installationId: request.body.repositoryBinding.installationId,
                  repositoryFullName:
                    request.body.repositoryBinding.repositoryFullName,
                },
              },
            )
          ).project
        } else {
          project = await createProjectUseCase(repository, pathPolicy, {
            id: request.body.id,
            name: request.body.name,
            description: request.body.description,
            ownerUserId,
            workspaceId,
            source: request.body.source,
          })
        }

        await options.onProjectCreated?.(project)

        return reply.status(201).send({
          ok: true,
          project,
        })
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.get<{ Params: ProjectIdParams }>(
    "/projects/:id",
    {
      schema: getProjectRouteSchema,
    },
    async (request) => {
      try {
        const actor = getAuthorizationActor(request)
        await requireRouteAuthorization(
          options.authorization,
          actor,
          "project.view",
          {
            kind: "project",
            projectId: request.params.id,
          },
        )
        const project = await getProjectUseCase(repository, request.params.id)

        return {
          ok: true,
          project,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.patch<{ Params: ProjectIdParams; Body: UpdateProjectBody }>(
    "/projects/:id",
    {
      schema: updateProjectRouteSchema,
    },
    async (request) => {
      try {
        const actor = getAuthorizationActor(request)
        await requireRouteAuthorization(
          options.authorization,
          actor,
          "project.update",
          {
            kind: "project",
            projectId: request.params.id,
          },
        )
        const project = await updateProjectUseCase(repository, pathPolicy, {
          projectId: request.params.id,
          changes: request.body,
        })

        return {
          ok: true,
          project,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.post<{ Params: ProjectIdParams }>(
    "/projects/:id/archive",
    {
      schema: archiveProjectRouteSchema,
    },
    async (request) => {
      try {
        const actor = getAuthorizationActor(request)
        await requireRouteAuthorization(
          options.authorization,
          actor,
          "project.archive",
          {
            kind: "project",
            projectId: request.params.id,
          },
        )
        const project = await archiveProjectUseCase(
          repository,
          request.params.id,
        )

        return {
          ok: true,
          project,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.post<{ Params: ProjectIdParams }>(
    "/projects/:id/restore",
    {
      schema: restoreProjectRouteSchema,
    },
    async (request) => {
      try {
        const actor = getAuthorizationActor(request)
        await requireRouteAuthorization(
          options.authorization,
          actor,
          "project.restore",
          {
            kind: "project",
            projectId: request.params.id,
          },
        )
        const project = await restoreProjectUseCase(
          repository,
          request.params.id,
        )

        return {
          ok: true,
          project,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )

  app.delete<{ Params: ProjectIdParams }>(
    "/projects/:id",
    {
      schema: deleteProjectRouteSchema,
    },
    async (request) => {
      try {
        const actor = getAuthorizationActor(request)
        await requireRouteAuthorization(
          options.authorization,
          actor,
          "project.delete",
          {
            kind: "project",
            projectId: request.params.id,
          },
        )
        const result = await deleteProjectUseCase(repository, request.params.id)

        return {
          ok: true,
          ...result,
        }
      } catch (error) {
        throw toProjectAppError(error)
      }
    },
  )
}
