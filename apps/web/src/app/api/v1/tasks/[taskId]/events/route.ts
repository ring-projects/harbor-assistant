import { getTaskEvents } from "@/services/tasks/task.service"

import { mapTaskRouteError, taskJson } from "../../utils"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    taskId: string
  }>
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

function isSseRequest(request: Request, format: string | null) {
  if (format === "json") {
    return false
  }

  const accept = request.headers.get("accept") ?? ""
  return accept.includes("text/event-stream") || format === "sse"
}

function toSseData(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

export async function GET(request: Request, context: RouteContext) {
  const { taskId } = await context.params
  const url = new URL(request.url)
  const format = url.searchParams.get("format")
  const afterSequence = parseNonNegativeInteger(
    url.searchParams.get("afterSequence"),
    0,
  )
  const limit = parsePositiveInteger(url.searchParams.get("limit"), 200)

  if (!isSseRequest(request, format)) {
    try {
      const { task, events, isTerminal } = await getTaskEvents({
        taskId,
        afterSequence,
        limit,
      })

      return taskJson({
        ok: true,
        task,
        events,
      }, isTerminal ? 200 : 206)
    } catch (error) {
      const mapped = mapTaskRouteError(error, "Failed to fetch task events.")
      return taskJson(
        {
          ok: false,
          error: mapped.payload,
        },
        mapped.status,
      )
    }
  }

  const encoder = new TextEncoder()
  let cursor = afterSequence
  let streamClosed = false
  let lastStatus: string | null = null
  let intervalId: ReturnType<typeof setInterval> | null = null
  let heartbeatId: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function closeStream() {
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
        request.signal.removeEventListener("abort", closeStream)
        controller.close()
      }

      async function publishNextEvents() {
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
            controller.enqueue(
              encoder.encode(
                toSseData("task_event", {
                  ...event,
                  taskId: task.id,
                }),
              ),
            )
          }

          if (lastStatus !== task.status) {
            lastStatus = task.status
            controller.enqueue(
              encoder.encode(
                toSseData("task_status", {
                  taskId: task.id,
                  status: task.status,
                }),
              ),
            )
          }

          if (isTerminal && events.length === 0) {
            controller.enqueue(
              encoder.encode(
                toSseData("task_end", {
                  taskId: task.id,
                  status: task.status,
                  cursor,
                }),
              ),
            )
            closeStream()
          }
        } catch (error) {
          const mapped = mapTaskRouteError(error, "Failed to stream task events.")
          controller.enqueue(
            encoder.encode(
              toSseData("task_error", {
                code: mapped.payload.code,
                message: mapped.payload.message,
              }),
            ),
          )
          closeStream()
        }
      }

      request.signal.addEventListener("abort", closeStream)

      controller.enqueue(
        encoder.encode(
          toSseData("ready", {
            taskId,
            cursor,
          }),
        ),
      )

      await publishNextEvents()
      if (streamClosed) {
        return
      }

      intervalId = setInterval(() => {
        void publishNextEvents()
      }, 1_000)

      heartbeatId = setInterval(() => {
        if (streamClosed) {
          return
        }
        controller.enqueue(encoder.encode(": heartbeat\n\n"))
      }, 15_000)
    },
    cancel() {
      streamClosed = true
      if (intervalId) {
        clearInterval(intervalId)
      }
      if (heartbeatId) {
        clearInterval(heartbeatId)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
