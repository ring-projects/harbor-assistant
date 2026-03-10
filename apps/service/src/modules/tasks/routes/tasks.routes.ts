import type { FastifyInstance } from "fastify"

import { toAppError } from "../../../lib/errors/error-response"
import {
  type CancelTaskBody,
  type CreateTaskBody,
  type FollowupTaskBody,
  type GetProjectTasksQuery,
  getTaskDiffRouteSchema,
  type GetTaskTimelineQuery,
  getProjectTasksRouteSchema,
  getTaskRouteSchema,
  getTaskTimelineRouteSchema,
  postCancelTaskRouteSchema,
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

function isSseRequest(args: {
  accept: string | string[] | undefined
  format: string | undefined
}) {
  if (args.format === "json") {
    return false
  }

  const acceptHeader = Array.isArray(args.accept)
    ? args.accept.join(",")
    : (args.accept ?? "")

  return acceptHeader.includes("text/event-stream") || args.format === "sse"
}

function toSseData(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
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

  app.get<{ Params: TaskIdParams }>(
    "/tasks/:taskId/diff",
    {
      schema: getTaskDiffRouteSchema,
    },
    async (request) => {
      const { taskId } = request.params
      const diff = await taskService.getTaskDiff({ taskId })

      return {
        ok: true,
        diff,
      }
    },
  )

  app.post<{ Params: TaskIdParams; Body: CancelTaskBody }>(
    "/tasks/:taskId/cancel",
    {
      schema: postCancelTaskRouteSchema,
    },
    async (request) => {
      const { taskId } = request.params
      const task = await taskService.cancelTask({
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

  app.get<{ Params: TaskIdParams; Querystring: GetTaskTimelineQuery }>(
    "/tasks/:taskId/timeline",
    {
      schema: getTaskTimelineRouteSchema,
    },
    async (request, reply) => {
      const { taskId } = request.params
      const query = request.query

      const format = query.format
      const afterSequence = normalizeNonNegativeInteger(query.afterSequence, 0)
      const limit = normalizePositiveInteger(query.limit, 200)

      if (!isSseRequest({ accept: request.headers.accept, format })) {
        const { task, timeline, isTerminal } = await taskService.getTaskTimeline({
          taskId,
          afterSequence,
          limit,
        })

        return reply.status(isTerminal ? 200 : 206).send({
          ok: true,
          task,
          timeline,
        })
      }

      let cursor = afterSequence
      let streamClosed = false
      let intervalId: ReturnType<typeof setInterval> | null = null
      let heartbeatId: ReturnType<typeof setInterval> | null = null

      const closeStream = () => {
        if (streamClosed) {
          return
        }

        streamClosed = true
        if (intervalId) {
          clearInterval(intervalId)
          intervalId = null
        }
        if (heartbeatId) {
          clearInterval(heartbeatId)
          heartbeatId = null
        }

        request.raw.removeListener("close", closeStream)
        request.raw.removeListener("aborted", closeStream)

        if (!reply.raw.writableEnded) {
          reply.raw.end()
        }
      }

      const publishNextItems = async () => {
        if (streamClosed) {
          return
        }

        try {
          const { task, timeline, isTerminal } = await taskService.getTaskTimeline({
            taskId,
            afterSequence: cursor,
            limit,
          })

          for (const item of timeline.items) {
            cursor = Math.max(cursor, item.sequence)
            reply.raw.write(toSseData("timeline_item", item))
          }

          if (isTerminal && timeline.items.length === 0) {
            reply.raw.write(
              toSseData("task_end", {
                taskId: task.id,
                status: task.status,
                cursor,
              }),
            )
            closeStream()
          }
        } catch (error) {
          const appError = toAppError(error)
          reply.raw.write(
            toSseData("task_error", {
              code: appError.code,
              message: appError.message,
            }),
          )
          closeStream()
        }
      }

      reply.raw.statusCode = 200
      reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8")
      reply.raw.setHeader("Cache-Control", "no-cache, no-transform")
      reply.raw.setHeader("Connection", "keep-alive")
      reply.raw.setHeader("X-Accel-Buffering", "no")
      reply.hijack()

      request.raw.on("close", closeStream)
      request.raw.on("aborted", closeStream)

      reply.raw.write(
        toSseData("ready", {
          taskId,
          cursor,
        }),
      )

      await publishNextItems()
      if (streamClosed) {
        return reply
      }

      intervalId = setInterval(() => {
        void publishNextItems()
      }, 1_000)

      heartbeatId = setInterval(() => {
        if (streamClosed) {
          return
        }
        reply.raw.write(": heartbeat\n\n")
      }, 15_000)

      return reply
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
