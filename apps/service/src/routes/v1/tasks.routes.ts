import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { ERROR_CODES } from "../../constants/errors"
import { TaskRepositoryError } from "../../modules/tasks/task.repository"
import {
  TaskServiceError,
  cancelTask,
  createTaskAndRun,
  getTaskConversation,
  getTaskDetail,
  getTaskEvents,
  listProjectTasks,
  retryTask,
} from "../../modules/tasks/task.service"

const CreateTaskInputSchema = z.object({
  projectId: z.string(),
  prompt: z.string(),
  model: z.string().optional(),
  executor: z.string().optional(),
})

const CancelTaskInputSchema = z.object({
  reason: z.string().optional(),
})

function statusFromTaskErrorCode(code: string) {
  if (
    code === ERROR_CODES.INVALID_PROJECT_ID ||
    code === ERROR_CODES.INVALID_PROMPT ||
    code === ERROR_CODES.INVALID_REQUEST_BODY ||
    code === ERROR_CODES.INVALID_TASK_ID ||
    code === ERROR_CODES.UNSUPPORTED_EXECUTOR
  ) {
    return 400
  }

  if (
    code === ERROR_CODES.PROJECT_NOT_FOUND ||
    code === ERROR_CODES.TASK_NOT_FOUND ||
    code === ERROR_CODES.NOT_FOUND
  ) {
    return 404
  }

  if (code === ERROR_CODES.INVALID_TASK_RETRY_STATE) {
    return 409
  }

  return 500
}

function mapTaskRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof TaskServiceError) {
    return {
      status: error.status,
      payload: {
        code: error.code,
        message: error.message,
      },
    }
  }

  if (error instanceof TaskRepositoryError) {
    return {
      status: statusFromTaskErrorCode(error.code),
      payload: {
        code: error.code,
        message: error.message,
      },
    }
  }

  return {
    status: 500,
    payload: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: fallbackMessage,
    },
  }
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.trunc(parsed)
}

function parseNonNegativeInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }

  return Math.trunc(parsed)
}

function parseOptionalLimit(value: string | null) {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return Math.trunc(parsed)
}

function isSseRequest(args: {
  accept: string | string[] | undefined
  format: string | null
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

export async function registerTaskRoutes(app: FastifyInstance) {
  app.post("/tasks", async (request, reply) => {
    const parsed = CreateTaskInputSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: ERROR_CODES.INVALID_REQUEST_BODY,
          message:
            "Expected payload: { projectId: string; prompt: string; model?: string; executor?: string }.",
        },
      })
    }

    try {
      const task = await createTaskAndRun(parsed.data)
      return reply.send({
        ok: true,
        task,
      })
    } catch (error) {
      const mapped = mapTaskRouteError(error, "Failed to create task.")
      return reply.status(mapped.status).send({
        ok: false,
        error: mapped.payload,
      })
    }
  })

  app.get("/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params as { taskId: string }

    try {
      const task = await getTaskDetail(taskId)
      return reply.send({
        ok: true,
        task,
      })
    } catch (error) {
      const mapped = mapTaskRouteError(error, "Failed to fetch task detail.")
      return reply.status(mapped.status).send({
        ok: false,
        error: mapped.payload,
      })
    }
  })

  app.post("/tasks/:taskId/cancel", async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const payload = request.body ?? {}

    const parsed = CancelTaskInputSchema.safeParse(payload)
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: ERROR_CODES.INVALID_REQUEST_BODY,
          message: "Expected payload: { reason?: string }.",
        },
      })
    }

    try {
      const task = await cancelTask({
        taskId,
        reason: parsed.data.reason,
      })

      return reply.send({
        ok: true,
        task,
      })
    } catch (error) {
      const mapped = mapTaskRouteError(error, "Failed to cancel task.")
      return reply.status(mapped.status).send({
        ok: false,
        error: mapped.payload,
      })
    }
  })

  app.post("/tasks/:taskId/retry", async (request, reply) => {
    const { taskId } = request.params as { taskId: string }

    try {
      const task = await retryTask({ taskId })
      return reply.send({
        ok: true,
        task,
      })
    } catch (error) {
      const mapped = mapTaskRouteError(error, "Failed to retry task.")
      return reply.status(mapped.status).send({
        ok: false,
        error: mapped.payload,
      })
    }
  })

  app.get("/tasks/:taskId/events", async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const query = request.query as {
      format?: string
      afterSequence?: string
      limit?: string
    }

    const format = typeof query.format === "string" ? query.format : null
    const afterSequence = parseNonNegativeInteger(
      typeof query.afterSequence === "string" ? query.afterSequence : null,
      0,
    )
    const limit = parsePositiveInteger(
      typeof query.limit === "string" ? query.limit : null,
      200,
    )

    if (!isSseRequest({ accept: request.headers.accept, format })) {
      try {
        const { task, events, isTerminal } = await getTaskEvents({
          taskId,
          afterSequence,
          limit,
        })

        return reply.status(isTerminal ? 200 : 206).send({
          ok: true,
          task,
          events,
        })
      } catch (error) {
        const mapped = mapTaskRouteError(error, "Failed to fetch task events.")
        return reply.status(mapped.status).send({
          ok: false,
          error: mapped.payload,
        })
      }
    }

    let cursor = afterSequence
    let streamClosed = false
    let lastStatus: string | null = null
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

    const publishNextEvents = async () => {
      if (streamClosed) {
        return
      }

      try {
        const { task, events, isTerminal } = await getTaskEvents({
          taskId,
          afterSequence: cursor,
          limit,
        })

        for (const event of events) {
          cursor = Math.max(cursor, event.sequence)
          reply.raw.write(
            toSseData("task_event", {
              ...event,
              taskId: task.id,
            }),
          )
        }

        if (lastStatus !== task.status) {
          lastStatus = task.status
          reply.raw.write(
            toSseData("task_status", {
              taskId: task.id,
              status: task.status,
            }),
          )
        }

        if (isTerminal && events.length === 0) {
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
        const mapped = mapTaskRouteError(error, "Failed to stream task events.")
        reply.raw.write(
          toSseData("task_error", {
            code: mapped.payload.code,
            message: mapped.payload.message,
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

    await publishNextEvents()
    if (streamClosed) {
      return reply
    }

    intervalId = setInterval(() => {
      void publishNextEvents()
    }, 1_000)

    heartbeatId = setInterval(() => {
      if (streamClosed) {
        return
      }
      reply.raw.write(": heartbeat\n\n")
    }, 15_000)

    return reply
  })

  app.get("/tasks/:taskId/conversation", async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const query = request.query as { limit?: string }

    try {
      const conversation = await getTaskConversation({
        taskId,
        limit: parseOptionalLimit(
          typeof query.limit === "string" ? query.limit : null,
        ),
      })

      return reply.send({
        ok: true,
        conversation,
      })
    } catch (error) {
      const mapped = mapTaskRouteError(
        error,
        "Failed to fetch task conversation.",
      )
      return reply.status(mapped.status).send({
        ok: false,
        error: mapped.payload,
      })
    }
  })

  app.get("/projects/:projectId/tasks", async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const query = request.query as { limit?: string }

    try {
      const tasks = await listProjectTasks({
        projectId,
        limit: parseOptionalLimit(
          typeof query.limit === "string" ? query.limit : null,
        ),
      })

      return reply.send({
        ok: true,
        tasks,
      })
    } catch (error) {
      const mapped = mapTaskRouteError(error, "Failed to fetch project tasks.")
      return reply.status(mapped.status).send({
        ok: false,
        tasks: [],
        error: mapped.payload,
      })
    }
  })
}
