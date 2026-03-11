import type { FastifyInstance } from "fastify"
import type { RawData, WebSocket } from "ws"

import { toAppError } from "../../../lib/errors/error-response"
import type { TaskEventBus, TaskService, TaskStreamEvent } from "../services"

type ClientEnvelope =
  | {
      type: "subscribe"
      taskId: string
      afterSequence?: number
    }
  | {
      type: "subscribe_project"
      projectId: string
      limit?: number
    }
  | {
      type: "unsubscribe"
      taskId: string
    }
  | {
      type: "unsubscribe_project"
      projectId: string
    }
  | {
      type: "ping"
    }

function parseEnvelope(message: RawData): ClientEnvelope | null {
  try {
    const raw = JSON.parse(message.toString())
    if (typeof raw !== "object" || raw === null || typeof raw.type !== "string") {
      return null
    }

    if (raw.type === "subscribe" && typeof raw.taskId === "string") {
      return {
        type: "subscribe",
        taskId: raw.taskId,
        afterSequence:
          typeof raw.afterSequence === "number" && Number.isFinite(raw.afterSequence)
            ? Math.max(0, Math.trunc(raw.afterSequence))
            : 0,
      }
    }

    if (raw.type === "unsubscribe" && typeof raw.taskId === "string") {
      return {
        type: "unsubscribe",
        taskId: raw.taskId,
      }
    }

    if (raw.type === "subscribe_project" && typeof raw.projectId === "string") {
      return {
        type: "subscribe_project",
        projectId: raw.projectId,
        limit:
          typeof raw.limit === "number" && Number.isFinite(raw.limit)
            ? Math.max(1, Math.trunc(raw.limit))
            : 200,
      }
    }

    if (raw.type === "unsubscribe_project" && typeof raw.projectId === "string") {
      return {
        type: "unsubscribe_project",
        projectId: raw.projectId,
      }
    }

    if (raw.type === "ping") {
      return { type: "ping" }
    }
  } catch {
    return null
  }

  return null
}

function sendJson(socket: WebSocket, payload: unknown) {
  if (socket.readyState !== socket.OPEN) {
    return
  }

  socket.send(JSON.stringify(payload))
}

function sendTaskStreamEvent(socket: WebSocket, event: TaskStreamEvent) {
  if (event.type === "agent_event") {
    sendJson(socket, {
      type: "agent_event",
      taskId: event.taskId,
      event: event.event,
    })
    return
  }

  if (event.type === "task_status") {
    sendJson(socket, {
      type: "task_status",
      taskId: event.taskId,
      status: event.status,
    })
    return
  }

  if (event.type === "task_upsert") {
    sendJson(socket, {
      type: "task_upsert",
      projectId: event.projectId,
      task: event.task,
    })
    return
  }

  sendJson(socket, {
    type: "task_end",
    taskId: event.taskId,
    status: event.status,
    cursor: event.cursor,
  })
}

export async function registerTaskWebsocketRoutes(
  app: FastifyInstance,
  args: {
    taskService: Pick<TaskService, "getTaskEvents" | "listProjectTasks">
    taskEventBus: Pick<TaskEventBus, "subscribe" | "subscribeProject">
  },
) {
  const { taskService, taskEventBus } = args

  app.get(
    "/ws/tasks",
    { websocket: true },
    (socket) => {
      const unsubscribeByTaskId = new Map<string, () => void>()
      const unsubscribeByProjectId = new Map<string, () => void>()
      const cursorByTaskId = new Map<string, number>()

      async function subscribeToTask(taskId: string, afterSequence: number) {
        const normalizedTaskId = taskId.trim()
        if (!normalizedTaskId) {
          sendJson(socket, {
            type: "task_error",
            code: "INVALID_TASK_ID",
            message: "taskId is required.",
          })
          return
        }

        unsubscribeByTaskId.get(normalizedTaskId)?.()
        unsubscribeByTaskId.delete(normalizedTaskId)

        try {
          const { task, events, isTerminal } = await taskService.getTaskEvents({
            taskId: normalizedTaskId,
            afterSequence,
            limit: 500,
          })

          let cursor = afterSequence

          sendJson(socket, {
            type: "ready",
            taskId: normalizedTaskId,
            cursor,
            status: task.status,
          })

          for (const event of events.items) {
            cursor = Math.max(cursor, event.sequence)
            sendJson(socket, {
              type: "agent_event",
              taskId: normalizedTaskId,
              event,
            })
          }

          cursorByTaskId.set(normalizedTaskId, cursor)

          if (isTerminal) {
            sendJson(socket, {
              type: "task_end",
              taskId: normalizedTaskId,
              status: task.status,
              cursor,
            })
            return
          }

          const unsubscribe = taskEventBus.subscribe(normalizedTaskId, (event) => {
            if (event.type === "agent_event") {
              const nextCursor = Math.max(
                cursorByTaskId.get(normalizedTaskId) ?? 0,
                event.event.sequence,
              )
              cursorByTaskId.set(normalizedTaskId, nextCursor)
            }

            if (event.type === "task_end") {
              const fallbackCursor = cursorByTaskId.get(normalizedTaskId) ?? 0
              sendTaskStreamEvent(socket, {
                ...event,
                cursor: event.cursor > 0 ? event.cursor : fallbackCursor,
              })
              unsubscribeByTaskId.get(normalizedTaskId)?.()
              unsubscribeByTaskId.delete(normalizedTaskId)
              return
            }

            sendTaskStreamEvent(socket, event)
          })

          unsubscribeByTaskId.set(normalizedTaskId, unsubscribe)
        } catch (error) {
          const appError = toAppError(error)
          sendJson(socket, {
            type: "task_error",
            taskId: normalizedTaskId,
            code: appError.code,
            message: appError.message,
          })
        }
      }

      async function subscribeToProject(projectId: string, limit: number) {
        const normalizedProjectId = projectId.trim()
        if (!normalizedProjectId) {
          sendJson(socket, {
            type: "task_error",
            code: "INVALID_PROJECT_ID",
            message: "projectId is required.",
          })
          return
        }

        unsubscribeByProjectId.get(normalizedProjectId)?.()
        unsubscribeByProjectId.delete(normalizedProjectId)

        try {
          const tasks = await taskService.listProjectTasks({
            projectId: normalizedProjectId,
            limit,
          })

          sendJson(socket, {
            type: "project_ready",
            projectId: normalizedProjectId,
          })

          for (const task of tasks) {
            sendJson(socket, {
              type: "task_upsert",
              projectId: normalizedProjectId,
              task,
            })
          }

          const unsubscribe = taskEventBus.subscribeProject(
            normalizedProjectId,
            (event) => {
              if (event.type !== "task_upsert") {
                return
              }

              sendJson(socket, {
                type: "task_upsert",
                projectId: normalizedProjectId,
                task: event.task,
              })
            },
          )

          unsubscribeByProjectId.set(normalizedProjectId, unsubscribe)
        } catch (error) {
          const appError = toAppError(error)
          sendJson(socket, {
            type: "task_error",
            code: appError.code,
            message: appError.message,
            projectId: normalizedProjectId,
          })
        }
      }

      socket.on("message", (message: RawData) => {
        const envelope = parseEnvelope(message)
        if (!envelope) {
          sendJson(socket, {
            type: "task_error",
            code: "INVALID_WS_MESSAGE",
            message: "Unsupported websocket payload.",
          })
          return
        }

        if (envelope.type === "ping") {
          sendJson(socket, { type: "pong" })
          return
        }

        if (envelope.type === "unsubscribe") {
          const taskId = envelope.taskId.trim()
          unsubscribeByTaskId.get(taskId)?.()
          unsubscribeByTaskId.delete(taskId)
          cursorByTaskId.delete(taskId)
          sendJson(socket, {
            type: "unsubscribed",
            taskId,
          })
          return
        }

        if (envelope.type === "unsubscribe_project") {
          const projectId = envelope.projectId.trim()
          unsubscribeByProjectId.get(projectId)?.()
          unsubscribeByProjectId.delete(projectId)
          sendJson(socket, {
            type: "project_unsubscribed",
            projectId,
          })
          return
        }

        if (envelope.type === "subscribe_project") {
          void subscribeToProject(envelope.projectId, envelope.limit ?? 200)
          return
        }

        void subscribeToTask(envelope.taskId, envelope.afterSequence ?? 0)
      })

      socket.on("close", () => {
        for (const unsubscribe of unsubscribeByTaskId.values()) {
          unsubscribe()
        }
        for (const unsubscribe of unsubscribeByProjectId.values()) {
          unsubscribe()
        }
        unsubscribeByTaskId.clear()
        unsubscribeByProjectId.clear()
        cursorByTaskId.clear()
      })
    },
  )
}
