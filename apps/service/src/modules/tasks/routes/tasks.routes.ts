import type { FastifyInstance } from "fastify"

import {
  type BreakTaskTurnBody,
  type CreateTaskBody,
  type FollowupTaskBody,
  type GetProjectTasksQuery,
  type GetTaskEventsQuery,
  getTaskEventsRouteSchema,
  getProjectTasksRouteSchema,
  getTaskRouteSchema,
  postBreakTaskTurnRouteSchema,
  postRetryTaskRouteSchema,
  type ProjectIdParams,
  type TaskIdParams,
  createTaskRouteSchema,
  followupTaskRouteSchema,
} from "../schemas"
import type { TaskService } from "../services"

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.trunc(value)
}

function normalizeNonNegativeInteger(
  value: number | undefined,
  fallback: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback
  }

  return Math.trunc(value)
}

function normalizeOptionalLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined
  }

  return Math.trunc(value)
}

export async function registerTaskRoutes(
  app: FastifyInstance,
  args: { taskService: TaskService },
) {
  const { taskService } = args

  app.post<{ Body: CreateTaskBody }>(
    "/tasks",
    {
      schema: createTaskRouteSchema,
    },
    async (request) => {
      const input = request.body

      const task = await taskService.createTaskAndRun({
        projectId: input.projectId,
        prompt: input.prompt,
        model: input.model,
        agentType: input.executor,
        executionMode: input.executionMode,
        runtimePolicy: input.runtimePolicy,
      })

      return {
        ok: true,
        task,
      }
    },
  )

  app.get<{ Params: TaskIdParams }>(
    "/tasks/:taskId",
    {
      schema: getTaskRouteSchema,
    },
    async (request) => {
      const { taskId } = request.params
      const task = await taskService.getTaskDetail(taskId)

      return {
        ok: true,
        task,
      }
    },
  )

  app.post<{ Params: TaskIdParams; Body: BreakTaskTurnBody }>(
    "/tasks/:taskId/break",
    {
      schema: postBreakTaskTurnRouteSchema,
    },
    async (request) => {
      const { taskId } = request.params
      const task = await taskService.breakTaskTurn({
        taskId,
        reason: request.body.reason,
      })

      return {
        ok: true,
        task,
      }
    },
  )

  app.post<{ Params: TaskIdParams }>(
    "/tasks/:taskId/retry",
    {
      schema: postRetryTaskRouteSchema,
    },
    async (request) => {
      const { taskId } = request.params
      const task = await taskService.retryTask({ taskId })

      return {
        ok: true,
        task,
      }
    },
  )

  app.post<{ Params: TaskIdParams; Body: FollowupTaskBody }>(
    "/tasks/:taskId/followup",
    {
      schema: followupTaskRouteSchema,
    },
    async (request) => {
      const { taskId } = request.params
      const input = request.body

      const task = await taskService.followupTask({
        taskId,
        prompt: input.prompt,
        model: input.model,
      })

      return {
        ok: true,
        task,
      }
    },
  )

  app.get<{ Params: TaskIdParams; Querystring: GetTaskEventsQuery }>(
    "/tasks/:taskId/events",
    {
      schema: getTaskEventsRouteSchema,
    },
    async (request, reply) => {
      const { taskId } = request.params
      const query = request.query

      const afterSequence = normalizeNonNegativeInteger(query.afterSequence, 0)
      const limit = normalizePositiveInteger(query.limit, 200)

      const { task, events, isTerminal } = await taskService.getTaskEvents({
        taskId,
        afterSequence,
        limit,
      })

      return reply.status(isTerminal ? 200 : 206).send({
        ok: true,
        task,
        events,
      })
    },
  )

  app.get<{ Params: ProjectIdParams; Querystring: GetProjectTasksQuery }>(
    "/projects/:projectId/tasks",
    {
      schema: getProjectTasksRouteSchema,
    },
    async (request) => {
      const { projectId } = request.params
      const tasks = await taskService.listProjectTasks({
        projectId,
        limit: normalizeOptionalLimit(request.query.limit),
      })

      return {
        ok: true,
        tasks,
      }
    },
  )
}
