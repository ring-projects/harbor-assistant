import type { FastifyInstance } from "fastify"
import type { Server as HttpServer } from "node:http"
import { Server, type Socket } from "socket.io"

import { toAppError } from "../../../lib/errors/error-response"
import type { ProjectGitChangeEvent, ProjectGitWatcher } from "../../git"
import type { TaskEventBus, TaskService, TaskStreamEvent } from "../services"
import { projectRoom, taskEventsRoom, taskRoom } from "./task-room"

type SubscribeProjectPayload = {
  projectId?: string
  limit?: number
}

type SubscribeTaskPayload = {
  taskId?: string
}

type SubscribeTaskEventsPayload = {
  taskId?: string
  afterSequence?: number
  limit?: number
}

type SubscribeProjectGitPayload = {
  projectId?: string
}

function normalizeLimit(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.trunc(value)
}

function normalizeAfterSequence(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0
  }

  return Math.trunc(value)
}

function emitStreamEvent(socket: Socket, event: TaskStreamEvent) {
  switch (event.type) {
    case "task_upsert":
      socket.emit("project:task_upsert", {
        projectId: event.projectId,
        task: event.task,
      })
      return
    case "task_status":
      socket.emit("task:status", {
        taskId: event.taskId,
        status: event.status,
      })
      return
    case "task_end":
      socket.emit("task:end", {
        taskId: event.taskId,
        status: event.status,
        cursor: event.cursor,
      })
      return
    case "agent_event":
      socket.emit("task-events:item", {
        taskId: event.taskId,
        event: event.event,
      })
      return
  }
}

function emitProjectGitChanged(
  socket: Pick<Socket, "emit">,
  event: ProjectGitChangeEvent,
) {
  socket.emit("project:git_changed", {
    projectId: event.projectId,
    changedAt: event.changedAt,
  })
}

async function handleProjectSubscription(args: {
  socket: Socket
  taskService: Pick<TaskService, "listProjectTasks">
  payload: SubscribeProjectPayload
}) {
  const projectId = args.payload.projectId?.trim() ?? ""
  if (!projectId) {
    args.socket.emit("subscription:error", {
      scope: "project",
      code: "INVALID_PROJECT_ID",
      message: "projectId is required.",
    })
    return
  }

  const limit = normalizeLimit(args.payload.limit, 200)

  try {
    args.socket.join(projectRoom(projectId))

    const tasks = await args.taskService.listProjectTasks({
      projectId,
      limit,
    })

    args.socket.emit("project:ready", { projectId })

    for (const task of tasks) {
      args.socket.emit("project:task_upsert", {
        projectId,
        task,
      })
    }
  } catch (error) {
    const appError = toAppError(error)
    args.socket.emit("subscription:error", {
      scope: "project",
      projectId,
      code: appError.code,
      message: appError.message,
    })
  }
}

async function handleTaskSubscription(args: {
  socket: Socket
  taskService: Pick<TaskService, "getTaskDetail">
  payload: SubscribeTaskPayload
}) {
  const taskId = args.payload.taskId?.trim() ?? ""
  if (!taskId) {
    args.socket.emit("subscription:error", {
      scope: "task",
      code: "INVALID_TASK_ID",
      message: "taskId is required.",
    })
    return
  }

  try {
    args.socket.join(taskRoom(taskId))

    const task = await args.taskService.getTaskDetail(taskId)
    args.socket.emit("task:ready", {
      taskId,
      task,
    })
  } catch (error) {
    const appError = toAppError(error)
    args.socket.emit("subscription:error", {
      scope: "task",
      taskId,
      code: appError.code,
      message: appError.message,
    })
  }
}

async function handleTaskEventsSubscription(args: {
  socket: Socket
  taskService: Pick<TaskService, "getTaskEvents">
  payload: SubscribeTaskEventsPayload
}) {
  const taskId = args.payload.taskId?.trim() ?? ""
  if (!taskId) {
    args.socket.emit("subscription:error", {
      scope: "task-events",
      code: "INVALID_TASK_ID",
      message: "taskId is required.",
    })
    return
  }

  const afterSequence = normalizeAfterSequence(args.payload.afterSequence)
  const limit = normalizeLimit(args.payload.limit, 500)

  try {
    args.socket.join(taskEventsRoom(taskId))

    const { task, events, isTerminal } = await args.taskService.getTaskEvents({
      taskId,
      afterSequence,
      limit,
    })

    args.socket.emit("task-events:ready", {
      taskId,
      cursor: afterSequence,
      status: task.status,
    })

    for (const event of events.items) {
      args.socket.emit("task-events:item", {
        taskId,
        event,
      })
    }

    if (isTerminal) {
      args.socket.emit("task:end", {
        taskId,
        status: task.status,
        cursor: events.nextSequence,
      })
    }
  } catch (error) {
    const appError = toAppError(error)
    args.socket.emit("subscription:error", {
      scope: "task-events",
      taskId,
      code: appError.code,
      message: appError.message,
    })
  }
}

export async function handleProjectGitSubscription(args: {
  socket: Pick<Socket, "emit">
  projectGitWatcher: Pick<ProjectGitWatcher, "subscribe">
  payload: SubscribeProjectGitPayload
  unsubscribeProjectGitById: Map<string, () => void>
}) {
  const projectId = args.payload.projectId?.trim() ?? ""
  if (!projectId) {
    args.socket.emit("subscription:error", {
      scope: "project-git",
      code: "INVALID_PROJECT_ID",
      message: "projectId is required.",
    })
    return
  }

  try {
    if (!args.unsubscribeProjectGitById.has(projectId)) {
      const unsubscribe = await args.projectGitWatcher.subscribe(projectId, (event) => {
        emitProjectGitChanged(args.socket, event)
      })

      args.unsubscribeProjectGitById.set(projectId, () => {
        void unsubscribe()
      })
    }

    args.socket.emit("project-git:ready", { projectId })
  } catch (error) {
    const appError = toAppError(error)
    args.socket.emit("subscription:error", {
      scope: "project-git",
      projectId,
      code: appError.code,
      message: appError.message,
    })
  }
}

export function createTaskSocketGateway(args: {
  app: FastifyInstance
  taskService: Pick<
    TaskService,
    "getTaskDetail" | "getTaskEvents" | "listProjectTasks"
  >
  taskEventBus: Pick<TaskEventBus, "subscribe" | "subscribeProject">
  projectGitWatcher: Pick<ProjectGitWatcher, "close" | "subscribe">
}) {
  const io = new Server(args.app.server as HttpServer, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
  })

  io.on("connection", (socket) => {
    const unsubscribeProjectById = new Map<string, () => void>()
    const unsubscribeProjectGitById = new Map<string, () => void>()
    const unsubscribeTaskById = new Map<string, () => void>()
    const unsubscribeTaskEventsById = new Map<string, () => void>()

    socket.on("subscribe:project", (payload: SubscribeProjectPayload = {}) => {
      const projectId = payload.projectId?.trim() ?? ""
      if (projectId && !unsubscribeProjectById.has(projectId)) {
        unsubscribeProjectById.set(
          projectId,
          args.taskEventBus.subscribeProject(projectId, (event) => {
            if (event.type === "task_upsert") {
              emitStreamEvent(socket, event)
            }
          }),
        )
      }

      void handleProjectSubscription({
        socket,
        taskService: args.taskService,
        payload,
      })
    })

    socket.on("unsubscribe:project", (payload: SubscribeProjectPayload = {}) => {
      const projectId = payload.projectId?.trim() ?? ""
      if (!projectId) {
        return
      }

      socket.leave(projectRoom(projectId))
      unsubscribeProjectById.get(projectId)?.()
      unsubscribeProjectById.delete(projectId)
      socket.emit("project:unsubscribed", { projectId })
    })

    socket.on("subscribe:project-git", (payload: SubscribeProjectGitPayload = {}) => {
      void handleProjectGitSubscription({
        socket,
        projectGitWatcher: args.projectGitWatcher,
        payload,
        unsubscribeProjectGitById,
      })
    })

    socket.on("unsubscribe:project-git", (payload: SubscribeProjectGitPayload = {}) => {
      const projectId = payload.projectId?.trim() ?? ""
      if (!projectId) {
        return
      }

      unsubscribeProjectGitById.get(projectId)?.()
      unsubscribeProjectGitById.delete(projectId)
      socket.emit("project-git:unsubscribed", { projectId })
    })

    socket.on("subscribe:task", (payload: SubscribeTaskPayload = {}) => {
      const taskId = payload.taskId?.trim() ?? ""
      if (taskId && !unsubscribeTaskById.has(taskId)) {
        unsubscribeTaskById.set(
          taskId,
          args.taskEventBus.subscribe(taskId, (event) => {
            if (event.type === "task_status" || event.type === "task_end") {
              emitStreamEvent(socket, event)
            }
          }),
        )
      }

      void handleTaskSubscription({
        socket,
        taskService: args.taskService,
        payload,
      })
    })

    socket.on("unsubscribe:task", (payload: SubscribeTaskPayload = {}) => {
      const taskId = payload.taskId?.trim() ?? ""
      if (!taskId) {
        return
      }

      socket.leave(taskRoom(taskId))
      unsubscribeTaskById.get(taskId)?.()
      unsubscribeTaskById.delete(taskId)
      socket.emit("task:unsubscribed", { taskId })
    })

    socket.on("subscribe:task-events", (payload: SubscribeTaskEventsPayload = {}) => {
      const taskId = payload.taskId?.trim() ?? ""
      if (taskId && !unsubscribeTaskEventsById.has(taskId)) {
        unsubscribeTaskEventsById.set(
          taskId,
          args.taskEventBus.subscribe(taskId, (event) => {
            if (event.type === "agent_event" || event.type === "task_end") {
              emitStreamEvent(socket, event)
            }
          }),
        )
      }

      void handleTaskEventsSubscription({
        socket,
        taskService: args.taskService,
        payload,
      })
    })

    socket.on(
      "unsubscribe:task-events",
      (payload: SubscribeTaskEventsPayload = {}) => {
        const taskId = payload.taskId?.trim() ?? ""
        if (!taskId) {
          return
        }

        socket.leave(taskEventsRoom(taskId))
        unsubscribeTaskEventsById.get(taskId)?.()
        unsubscribeTaskEventsById.delete(taskId)
        socket.emit("task-events:unsubscribed", { taskId })
      },
    )

    socket.on("disconnect", () => {
      for (const unsubscribe of unsubscribeProjectById.values()) {
        unsubscribe()
      }
      for (const unsubscribe of unsubscribeTaskById.values()) {
        unsubscribe()
      }
      for (const unsubscribe of unsubscribeProjectGitById.values()) {
        unsubscribe()
      }
      for (const unsubscribe of unsubscribeTaskEventsById.values()) {
        unsubscribe()
      }
      unsubscribeProjectById.clear()
      unsubscribeProjectGitById.clear()
      unsubscribeTaskById.clear()
      unsubscribeTaskEventsById.clear()
    })
  })

  args.app.addHook("onClose", async () => {
    await args.projectGitWatcher.close()
    await io.close()
  })

  return io
}
