import type { FastifyInstance } from "fastify"

import { ERROR_CODES } from "../../../constants/errors"
import { AppError } from "../../../lib/errors/app-error"
import type { ProjectRepository } from "../../project/application/project-repository"
import type { AuthorizationService } from "../../authorization"
import { getAuthenticatedActor } from "../../auth"
import { captureSandboxSnapshotUseCase } from "../application/capture-sandbox-snapshot"
import { provisionSandboxUseCase } from "../application/provision-sandbox"
import type { SandboxProvisioningPort } from "../application/sandbox-provider"
import type { SandboxRegistry } from "../application/sandbox-registry"
import { startSandboxCommandUseCase } from "../application/start-sandbox-command"
import { terminateSandboxUseCase } from "../application/terminate-sandbox"
import { toSandboxAppError } from "../sandbox-app-error"
import type {
  CreateSandboxBody,
  ProjectSandboxIdParams,
  SandboxCommandIdParams,
  SandboxIdParams,
  SandboxPreviewParams,
  SandboxSnapshotIdParams,
  StartSandboxCommandBody,
} from "../schemas"
import {
  createSandboxRouteSchema,
  createSandboxSnapshotRouteSchema,
  deleteSandboxRouteSchema,
  getSandboxCommandRouteSchema,
  getSandboxPreviewRouteSchema,
  getSandboxRouteSchema,
  listProjectSandboxesRouteSchema,
  listSandboxCommandsRouteSchema,
  listSandboxSnapshotsRouteSchema,
  restoreSandboxSnapshotRouteSchema,
  startSandboxCommandRouteSchema,
} from "../schemas"

function resolveSandboxSourceFromProject(
  project: Awaited<ReturnType<ProjectRepository["findById"]>>,
) {
  if (!project) {
    throw new AppError(ERROR_CODES.PROJECT_NOT_FOUND, 404, "Project not found.")
  }

  if (project.rootPath?.trim()) {
    return {
      type: "directory" as const,
      path: project.rootPath.trim(),
    }
  }

  if (project.source.type === "git") {
    return {
      type: "git" as const,
      repositoryUrl: project.source.repositoryUrl,
      ref: project.source.branch,
    }
  }

  throw new AppError(
    ERROR_CODES.INVALID_PROJECT_STATE,
    409,
    "Project does not have a usable local path or git source for sandbox provisioning.",
  )
}

async function requireSandboxProjectAccess(input: {
  authorization: AuthorizationService
  registry: SandboxRegistry
  sandboxId: string
  actor: ReturnType<typeof getAuthenticatedActor>
  action: "project.view" | "project.tasks.create"
}) {
  const sandbox = await input.registry.findSandboxById(input.sandboxId)
  if (!sandbox) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 404, "Sandbox not found.")
  }

  const projectId = sandbox.metadata.projectId?.trim()
  if (!projectId) {
    throw new AppError(
      ERROR_CODES.NOT_FOUND,
      404,
      "Sandbox project binding was not found.",
    )
  }

  await input.authorization.requireAuthorized({
    actor: input.actor,
    action: input.action,
    resource: {
      kind: "project",
      projectId,
    },
  })

  return sandbox
}

export async function registerSandboxModuleRoutes(
  app: FastifyInstance,
  options: {
    authorization: AuthorizationService
    projectRepository: Pick<ProjectRepository, "findById">
    provider: SandboxProvisioningPort
    registry: SandboxRegistry
  },
) {
  app.post<{ Params: ProjectSandboxIdParams; Body: CreateSandboxBody }>(
    "/projects/:projectId/sandboxes",
    {
      schema: createSandboxRouteSchema,
    },
    async (request, reply) => {
      try {
        const actor = getAuthenticatedActor(request)
        await options.authorization.requireAuthorized({
          actor,
          action: "project.tasks.create",
          resource: {
            kind: "project",
            projectId: request.params.projectId,
          },
        })

        const project = await options.projectRepository.findById(
          request.params.projectId,
        )
        const sandbox = await provisionSandboxUseCase(
          {
            provider: options.provider,
            registry: options.registry,
          },
          {
            mode: request.body?.mode ?? "connected",
            source: resolveSandboxSourceFromProject(project),
            projectId: request.params.projectId,
            taskId: request.body?.taskId ?? null,
            purpose: request.body?.purpose ?? "development",
            labels: request.body?.labels,
          },
        )

        return reply.status(201).send({
          ok: true,
          sandbox,
        })
      } catch (error) {
        throw toSandboxAppError(error)
      }
    },
  )

  app.get<{ Params: ProjectSandboxIdParams }>(
    "/projects/:projectId/sandboxes",
    {
      schema: listProjectSandboxesRouteSchema,
    },
    async (request) => {
      try {
        const actor = getAuthenticatedActor(request)
        await options.authorization.requireAuthorized({
          actor,
          action: "project.view",
          resource: {
            kind: "project",
            projectId: request.params.projectId,
          },
        })

        return {
          ok: true,
          sandboxes: await options.registry.listSandboxesByProject(
            request.params.projectId,
          ),
        }
      } catch (error) {
        throw toSandboxAppError(error)
      }
    },
  )

  app.get<{ Params: SandboxIdParams }>(
    "/sandboxes/:sandboxId",
    {
      schema: getSandboxRouteSchema,
    },
    async (request) => {
      try {
        const sandbox = await requireSandboxProjectAccess({
          authorization: options.authorization,
          registry: options.registry,
          sandboxId: request.params.sandboxId,
          actor: getAuthenticatedActor(request),
          action: "project.view",
        })

        return {
          ok: true,
          sandbox,
        }
      } catch (error) {
        throw toSandboxAppError(error)
      }
    },
  )

  app.delete<{ Params: SandboxIdParams }>(
    "/sandboxes/:sandboxId",
    {
      schema: deleteSandboxRouteSchema,
    },
    async (request) => {
      try {
        const sandbox = await requireSandboxProjectAccess({
          authorization: options.authorization,
          registry: options.registry,
          sandboxId: request.params.sandboxId,
          actor: getAuthenticatedActor(request),
          action: "project.tasks.create",
        })

        const stopped = await terminateSandboxUseCase(
          {
            provider: options.provider,
            registry: options.registry,
          },
          {
            sandboxId: sandbox.id,
          },
        )

        return {
          ok: true,
          sandbox: stopped,
        }
      } catch (error) {
        throw toSandboxAppError(error)
      }
    },
  )

  app.post<{ Params: SandboxIdParams; Body: StartSandboxCommandBody }>(
    "/sandboxes/:sandboxId/commands",
    {
      schema: startSandboxCommandRouteSchema,
    },
    async (request, reply) => {
      try {
        const sandbox = await requireSandboxProjectAccess({
          authorization: options.authorization,
          registry: options.registry,
          sandboxId: request.params.sandboxId,
          actor: getAuthenticatedActor(request),
          action: "project.tasks.create",
        })

        const command = await startSandboxCommandUseCase(
          {
            provider: options.provider,
            registry: options.registry,
          },
          {
            sandboxId: sandbox.id,
            command: request.body.command,
            cwd: request.body.cwd,
            env: request.body.env,
            detached: request.body.detached,
          },
        )

        return reply.status(201).send({
          ok: true,
          command,
        })
      } catch (error) {
        throw toSandboxAppError(error)
      }
    },
  )

  app.get<{ Params: SandboxIdParams }>(
    "/sandboxes/:sandboxId/commands",
    {
      schema: listSandboxCommandsRouteSchema,
    },
    async (request) => {
      try {
        const sandbox = await requireSandboxProjectAccess({
          authorization: options.authorization,
          registry: options.registry,
          sandboxId: request.params.sandboxId,
          actor: getAuthenticatedActor(request),
          action: "project.view",
        })

        return {
          ok: true,
          commands: await options.registry.listCommandsBySandbox(sandbox.id),
        }
      } catch (error) {
        throw toSandboxAppError(error)
      }
    },
  )

  app.get<{ Params: SandboxCommandIdParams }>(
    "/sandboxes/:sandboxId/commands/:commandId",
    {
      schema: getSandboxCommandRouteSchema,
    },
    async (request) => {
      try {
        const sandbox = await requireSandboxProjectAccess({
          authorization: options.authorization,
          registry: options.registry,
          sandboxId: request.params.sandboxId,
          actor: getAuthenticatedActor(request),
          action: "project.view",
        })

        const command = await options.registry.findCommandById(
          request.params.commandId,
        )
        if (!command || command.sandboxId !== sandbox.id) {
          throw new AppError(
            ERROR_CODES.NOT_FOUND,
            404,
            "Sandbox command not found.",
          )
        }

        return {
          ok: true,
          command,
        }
      } catch (error) {
        throw toSandboxAppError(error)
      }
    },
  )

  app.post<{ Params: SandboxIdParams }>(
    "/sandboxes/:sandboxId/snapshots",
    {
      schema: createSandboxSnapshotRouteSchema,
    },
    async (request, reply) => {
      try {
        const sandbox = await requireSandboxProjectAccess({
          authorization: options.authorization,
          registry: options.registry,
          sandboxId: request.params.sandboxId,
          actor: getAuthenticatedActor(request),
          action: "project.tasks.create",
        })

        const snapshot = await captureSandboxSnapshotUseCase(
          {
            provider: options.provider,
            registry: options.registry,
          },
          {
            sandboxId: sandbox.id,
          },
        )

        return reply.status(201).send({
          ok: true,
          snapshot,
        })
      } catch (error) {
        throw toSandboxAppError(error)
      }
    },
  )

  app.get<{ Params: SandboxIdParams }>(
    "/sandboxes/:sandboxId/snapshots",
    {
      schema: listSandboxSnapshotsRouteSchema,
    },
    async (request) => {
      try {
        const sandbox = await requireSandboxProjectAccess({
          authorization: options.authorization,
          registry: options.registry,
          sandboxId: request.params.sandboxId,
          actor: getAuthenticatedActor(request),
          action: "project.view",
        })

        return {
          ok: true,
          snapshots: await options.registry.listSnapshotsBySandbox(sandbox.id),
        }
      } catch (error) {
        throw toSandboxAppError(error)
      }
    },
  )

  app.post<{ Params: SandboxSnapshotIdParams; Body: CreateSandboxBody }>(
    "/sandbox-snapshots/:snapshotId/sandboxes",
    {
      schema: restoreSandboxSnapshotRouteSchema,
    },
    async (request, reply) => {
      try {
        const snapshot = await options.registry.findSnapshotById(
          request.params.snapshotId,
        )
        if (!snapshot) {
          throw new AppError(
            ERROR_CODES.NOT_FOUND,
            404,
            "Sandbox snapshot not found.",
          )
        }

        const sourceSandbox = await requireSandboxProjectAccess({
          authorization: options.authorization,
          registry: options.registry,
          sandboxId: snapshot.sandboxId,
          actor: getAuthenticatedActor(request),
          action: "project.tasks.create",
        })

        const sandbox = await provisionSandboxUseCase(
          {
            provider: options.provider,
            registry: options.registry,
          },
          {
            mode: request.body?.mode ?? sourceSandbox.mode,
            source: {
              type: "snapshot",
              snapshotId: snapshot.providerSnapshotId,
            },
            projectId: sourceSandbox.metadata.projectId,
            taskId: request.body?.taskId ?? null,
            purpose: request.body?.purpose ?? sourceSandbox.metadata.purpose,
            labels: request.body?.labels ?? sourceSandbox.metadata.labels,
          },
        )

        return reply.status(201).send({
          ok: true,
          sandbox,
        })
      } catch (error) {
        throw toSandboxAppError(error)
      }
    },
  )

  app.get<{ Params: SandboxPreviewParams }>(
    "/sandboxes/:sandboxId/previews/:port",
    {
      schema: getSandboxPreviewRouteSchema,
    },
    async (request) => {
      try {
        const sandbox = await requireSandboxProjectAccess({
          authorization: options.authorization,
          registry: options.registry,
          sandboxId: request.params.sandboxId,
          actor: getAuthenticatedActor(request),
          action: "project.view",
        })

        const url = await options.provider.resolvePreviewUrl({
          providerSandboxId: sandbox.providerSandboxId,
          port: request.params.port,
        })

        return {
          ok: true,
          url,
        }
      } catch (error) {
        throw toSandboxAppError(error)
      }
    },
  )
}
