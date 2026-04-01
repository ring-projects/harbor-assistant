import type { FastifyInstance } from "fastify"

import { createOrchestrationUseCase } from "../application/create-orchestration"
import { createOrchestrationTaskUseCase } from "../application/create-orchestration-task"
import { getOrchestrationDetailUseCase } from "../application/get-orchestration-detail"
import { listOrchestrationTasksUseCase } from "../application/list-orchestration-tasks"
import { listProjectOrchestrationsUseCase } from "../application/list-project-orchestrations"
import type { OrchestrationRepository } from "../application/orchestration-repository"
import type { OrchestrationTaskPort } from "../application/orchestration-task-port"
import { toOrchestrationAppError } from "../orchestration-app-error"
import type { ProjectRepository } from "../../project/application/project-repository"
import type { TaskRepository } from "../../task/application/task-repository"
import {
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
    projectRepository: Pick<ProjectRepository, "findById">
    taskRepository: Pick<TaskRepository, "listByProject" | "listByOrchestration">
    taskPort: OrchestrationTaskPort
  },
) {
  const {
    repository,
    projectRepository,
    taskRepository,
    taskPort,
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
            taskRepository,
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
        const orchestration = await getOrchestrationDetailUseCase(
          {
            repository,
            taskRepository,
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
            taskPort,
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
            taskPort,
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
