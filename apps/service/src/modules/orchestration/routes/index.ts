import type { FastifyInstance } from "fastify"

import { bootstrapOrchestrationUseCase } from "../application/bootstrap-orchestration"
import { createOrchestrationUseCase } from "../application/create-orchestration"
import { createOrchestrationTaskUseCase } from "../application/create-orchestration-task"
import { getOrchestrationUseCase } from "../application/get-orchestration"
import { listOrchestrationTasksUseCase } from "../application/list-orchestration-tasks"
import { listProjectOrchestrationsUseCase } from "../application/list-project-orchestrations"
import type { OrchestrationBootstrapStore } from "../application/orchestration-bootstrap-store"
import type { OrchestrationRepository } from "../application/orchestration-repository"
import { toOrchestrationAppError } from "../orchestration-app-error"
import type { ProjectRepository } from "../../project/application/project-repository"
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
  type CreateOrchestrationBody,
  type CreateOrchestrationTaskBody,
  type ListOrchestrationTasksQuery,
  type OrchestrationIdParams,
  type ProjectIdParams,
} from "../schemas"

export async function registerOrchestrationModuleRoutes(
  app: FastifyInstance,
  options: {
    repository: OrchestrationRepository
    bootstrapStore: OrchestrationBootstrapStore
    projectRepository: Pick<ProjectRepository, "findById">
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
        const orchestration = await createOrchestrationUseCase(
          {
            repository,
            projectRepository,
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
        const result = await bootstrapOrchestrationUseCase(
          {
            bootstrapStore,
            projectRepository,
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

  app.get<{ Params: ProjectIdParams }>(
    "/projects/:projectId/orchestrations",
    {
      schema: listProjectOrchestrationsRouteSchema,
    },
    async (request) => {
      try {
        const orchestrations = await listProjectOrchestrationsUseCase(
          {
            repository,
            projectRepository,
          },
          request.params.projectId,
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

  app.post<{ Params: OrchestrationIdParams; Body: CreateOrchestrationTaskBody }>(
    "/orchestrations/:orchestrationId/tasks",
    {
      schema: createOrchestrationTaskRouteSchema,
    },
    async (request, reply) => {
      try {
        const task = await createOrchestrationTaskUseCase(
          {
            repository,
            projectTaskPort,
            taskRepository,
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

  app.get<{ Params: OrchestrationIdParams; Querystring: ListOrchestrationTasksQuery }>(
    "/orchestrations/:orchestrationId/tasks",
    {
      schema: listOrchestrationTasksRouteSchema,
    },
    async (request) => {
      try {
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
