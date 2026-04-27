import type { FastifyInstance } from "fastify"

import type { AuthorizationService } from "../../authorization"
import { getAuthenticatedActor } from "../../auth"
import { bootstrapOrchestrationUseCase } from "../application/bootstrap-orchestration"
import { createOrchestrationUseCase } from "../application/create-orchestration"
import { createOrchestrationTaskUseCase } from "../application/create-orchestration-task"
import { getOrchestrationUseCase } from "../application/get-orchestration"
import { listOrchestrationTasksUseCase } from "../application/list-orchestration-tasks"
import { listProjectOrchestrationsUseCase } from "../application/list-project-orchestrations"
import { updateOrchestrationUseCase } from "../application/update-orchestration"
import { upsertOrchestrationScheduleUseCase } from "../application/upsert-orchestration-schedule"
import type { OrchestrationBootstrapStore } from "../application/orchestration-bootstrap-store"
import type { OrchestrationRepository } from "../application/orchestration-repository"
import { toOrchestrationAppError } from "../orchestration-app-error"
import type { ProjectRepository } from "../../project/application/project-repository"
import type { WorkspaceRepository } from "../../workspace"
import type { ProjectTaskPort } from "../../task/application/project-task-port"
import type { TaskNotificationPublisher } from "../../task/application/task-notification"
import type { TaskRecordStore } from "../../task/application/task-record-store"
import type { TaskRepository } from "../../task/application/task-repository"
import type { TaskRuntimePort } from "../../task/application/task-runtime-port"
import {
  bootstrapOrchestrationRouteSchema,
  type BootstrapOrchestrationBody,
  createOrchestrationRouteSchema,
  createOrchestrationTaskRouteSchema,
  getOrchestrationRouteSchema,
  listOrchestrationTasksRouteSchema,
  listProjectOrchestrationsRouteSchema,
  updateOrchestrationRouteSchema,
  upsertOrchestrationScheduleRouteSchema,
  type CreateOrchestrationBody,
  type CreateOrchestrationTaskBody,
  type ListProjectOrchestrationsQuery,
  type ListOrchestrationTasksQuery,
  type OrchestrationIdParams,
  type ProjectIdParams,
  type UpdateOrchestrationBody,
  type UpsertOrchestrationScheduleBody,
} from "../schemas"

export async function registerOrchestrationModuleRoutes(
  app: FastifyInstance,
  options: {
    authorization: AuthorizationService
    repository: OrchestrationRepository
    bootstrapStore: OrchestrationBootstrapStore
    projectRepository: Pick<ProjectRepository, "findById"> & {
      findByIdAndOwnerUserId?: ProjectRepository["findByIdAndOwnerUserId"]
    }
    workspaceRepository?: WorkspaceRepository
    projectTaskPort: ProjectTaskPort
    taskRepository: TaskRepository & TaskRecordStore
    runtimePort: TaskRuntimePort
    notificationPublisher: TaskNotificationPublisher
  },
) {
  const {
    repository,
    bootstrapStore,
    projectRepository,
    workspaceRepository,
    projectTaskPort,
    taskRepository,
    runtimePort,
    notificationPublisher,
  } = options

  app.post<{ Body: CreateOrchestrationBody }>(
    "/orchestrations",
    {
      schema: createOrchestrationRouteSchema,
    },
    async (request, reply) => {
      try {
        await options.authorization.requireAuthorized({
          actor: getAuthenticatedActor(request),
          action: "project.tasks.create",
          resource: { kind: "project", projectId: request.body.projectId },
        })
        const orchestration = await createOrchestrationUseCase(
          {
            repository,
            projectRepository: projectRepository as ProjectRepository,
          },
          request.body,
        )

        return reply.status(201).send({
          ok: true,
          orchestration,
        })
      } catch (error) {
        throw toOrchestrationAppError(error)
      }
    },
  )

  app.post<{ Body: BootstrapOrchestrationBody }>(
    "/orchestrations/bootstrap",
    {
      schema: bootstrapOrchestrationRouteSchema,
    },
    async (request, reply) => {
      try {
        await options.authorization.requireAuthorized({
          actor: getAuthenticatedActor(request),
          action: "project.tasks.create",
          resource: { kind: "project", projectId: request.body.projectId },
        })
        const result = await bootstrapOrchestrationUseCase(
          {
            bootstrapStore,
            projectRepository: projectRepository as ProjectRepository,
            taskRepository,
            runtimePort,
            notificationPublisher,
          },
          request.body,
        )

        return reply.status(201).send({
          ok: true,
          orchestration: result.orchestration,
          task: result.task,
          bootstrap: result.bootstrap,
        })
      } catch (error) {
        throw toOrchestrationAppError(error)
      }
    },
  )

  app.get<{
    Params: ProjectIdParams
    Querystring: ListProjectOrchestrationsQuery
  }>(
    "/projects/:projectId/orchestrations",
    {
      schema: listProjectOrchestrationsRouteSchema,
    },
    async (request) => {
      try {
        await options.authorization.requireAuthorized({
          actor: getAuthenticatedActor(request),
          action: "project.view",
          resource: { kind: "project", projectId: request.params.projectId },
        })
        const orchestrations = await listProjectOrchestrationsUseCase(
          {
            repository,
            projectRepository: projectRepository as ProjectRepository,
          },
          {
            projectId: request.params.projectId,
            surface: request.query.surface,
          },
        )

        return {
          ok: true,
          orchestrations,
        }
      } catch (error) {
        throw toOrchestrationAppError(error)
      }
    },
  )

  app.get<{ Params: OrchestrationIdParams }>(
    "/orchestrations/:orchestrationId",
    {
      schema: getOrchestrationRouteSchema,
    },
    async (request) => {
      try {
        await options.authorization.requireAuthorized({
          actor: getAuthenticatedActor(request),
          action: "orchestration.view",
          resource: {
            kind: "orchestration",
            orchestrationId: request.params.orchestrationId,
          },
        })
        const orchestration = await getOrchestrationUseCase(
          {
            repository,
          },
          request.params.orchestrationId,
        )

        return {
          ok: true,
          orchestration,
        }
      } catch (error) {
        throw toOrchestrationAppError(error)
      }
    },
  )

  app.patch<{
    Params: OrchestrationIdParams
    Body: UpdateOrchestrationBody
  }>(
    "/orchestrations/:orchestrationId",
    {
      schema: updateOrchestrationRouteSchema,
    },
    async (request) => {
      try {
        await options.authorization.requireAuthorized({
          actor: getAuthenticatedActor(request),
          action: "orchestration.update",
          resource: {
            kind: "orchestration",
            orchestrationId: request.params.orchestrationId,
          },
        })
        const orchestration = await updateOrchestrationUseCase(
          {
            repository,
          },
          {
            orchestrationId: request.params.orchestrationId,
            ...request.body,
          },
        )

        return {
          ok: true,
          orchestration,
        }
      } catch (error) {
        throw toOrchestrationAppError(error)
      }
    },
  )

  app.put<{
    Params: OrchestrationIdParams
    Body: UpsertOrchestrationScheduleBody
  }>(
    "/orchestrations/:orchestrationId/schedule",
    {
      schema: upsertOrchestrationScheduleRouteSchema,
    },
    async (request) => {
      try {
        await options.authorization.requireAuthorized({
          actor: getAuthenticatedActor(request),
          action: "orchestration.schedule.update",
          resource: {
            kind: "orchestration",
            orchestrationId: request.params.orchestrationId,
          },
        })
        const orchestration = await upsertOrchestrationScheduleUseCase(
          {
            repository,
          },
          {
            orchestrationId: request.params.orchestrationId,
            ...request.body,
          },
        )

        return {
          ok: true,
          orchestration,
        }
      } catch (error) {
        throw toOrchestrationAppError(error)
      }
    },
  )

  app.post<{
    Params: OrchestrationIdParams
    Body: CreateOrchestrationTaskBody
  }>(
    "/orchestrations/:orchestrationId/tasks",
    {
      schema: createOrchestrationTaskRouteSchema,
    },
    async (request, reply) => {
      try {
        await options.authorization.requireAuthorized({
          actor: getAuthenticatedActor(request),
          action: "orchestration.task.create",
          resource: {
            kind: "orchestration",
            orchestrationId: request.params.orchestrationId,
          },
        })
        const task = await createOrchestrationTaskUseCase(
          {
            repository,
            projectTaskPort,
            taskRepository: taskRepository as TaskRepository & TaskRecordStore,
            runtimePort,
            notificationPublisher,
          },
          {
            orchestrationId: request.params.orchestrationId,
            ...request.body,
          },
        )

        return reply.status(201).send({
          ok: true,
          task,
        })
      } catch (error) {
        throw toOrchestrationAppError(error)
      }
    },
  )

  app.get<{
    Params: OrchestrationIdParams
    Querystring: ListOrchestrationTasksQuery
  }>(
    "/orchestrations/:orchestrationId/tasks",
    {
      schema: listOrchestrationTasksRouteSchema,
    },
    async (request) => {
      try {
        await options.authorization.requireAuthorized({
          actor: getAuthenticatedActor(request),
          action: "orchestration.view",
          resource: {
            kind: "orchestration",
            orchestrationId: request.params.orchestrationId,
          },
        })
        const tasks = await listOrchestrationTasksUseCase(
          {
            repository,
            taskRepository,
          },
          {
            orchestrationId: request.params.orchestrationId,
            includeArchived: request.query.includeArchived,
            limit: request.query.limit,
          },
        )

        return {
          ok: true,
          tasks,
        }
      } catch (error) {
        throw toOrchestrationAppError(error)
      }
    },
  )
}
