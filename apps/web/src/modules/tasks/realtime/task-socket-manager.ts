"use client"

import type { QueryClient } from "@tanstack/react-query"
import { io, type Socket } from "socket.io-client"

import { getTaskSocketBaseUrl } from "@/modules/tasks/api"
import type {
  TaskAgentEvent,
  TaskAgentEventStream,
  TaskDetail,
  TaskListItem,
  TaskStatus,
} from "@/modules/tasks/contracts"

import { taskQueryKeys } from "../hooks/use-task-queries"

type ProjectTaskUpsertPayload = {
  projectId: string
  task: Record<string, unknown>
}

type TaskReadyPayload = {
  taskId: string
  task: Record<string, unknown>
}

type TaskStatusPayload = {
  taskId: string
  status: TaskStatus
}

type TaskEndPayload = {
  taskId: string
  status: TaskStatus
  cursor: number
}

type TaskEventsReadyPayload = {
  taskId: string
  cursor: number
  status: TaskStatus
}

type TaskEventsItemPayload = {
  taskId: string
  event: TaskAgentEvent
}

type SubscriptionErrorPayload = {
  scope: string
  code: string
  message: string
  projectId?: string
  taskId?: string
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function toStringOrEmpty(value: unknown) {
  return typeof value === "string" ? value : ""
}

function toIntegerOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) {
      return parsed
    }
  }

  return null
}

function toCommand(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string")
}

function normalizeTask(input: Record<string, unknown>): TaskListItem | null {
  const taskId = toStringOrNull(input.taskId) ?? toStringOrNull(input.id)
  const projectId = toStringOrNull(input.projectId)
  const status = toStringOrNull(input.status)

  if (
    !taskId ||
    !projectId ||
    (status !== "queued" &&
      status !== "running" &&
      status !== "completed" &&
      status !== "failed" &&
      status !== "cancelled")
  ) {
    return null
  }

  return {
    taskId,
    projectId,
    prompt: toStringOrEmpty(input.prompt),
    model: toStringOrNull(input.model),
    executor: toStringOrNull(input.executor) ?? "codex",
    status,
    threadId: toStringOrNull(input.threadId),
    parentTaskId: toStringOrNull(input.parentTaskId),
    createdAt: toStringOrNull(input.createdAt) ?? new Date().toISOString(),
    startedAt: toStringOrNull(input.startedAt),
    finishedAt: toStringOrNull(input.finishedAt),
    exitCode: toIntegerOrNull(input.exitCode),
    command: toCommand(input.command),
    stdout: toStringOrEmpty(input.stdout),
    stderr: toStringOrEmpty(input.stderr),
    error: toStringOrNull(input.error),
  }
}

function upsertTask(
  current: TaskListItem[] | undefined,
  incoming: TaskListItem,
): TaskListItem[] {
  const next = current ? [...current] : []
  const index = next.findIndex((task) => task.taskId === incoming.taskId)

  if (index >= 0) {
    next[index] = incoming
  } else {
    next.push(incoming)
  }

  next.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )

  return next
}

function patchTaskStatus<T extends TaskDetail | TaskListItem>(task: T, status: TaskStatus): T {
  const nextTask = {
    ...task,
    status,
  }

  if (status === "running" && !task.startedAt) {
    nextTask.startedAt = new Date().toISOString()
    nextTask.finishedAt = null
    nextTask.exitCode = null
    nextTask.error = null
  }

  if (status === "completed" || status === "failed" || status === "cancelled") {
    nextTask.finishedAt = task.finishedAt ?? new Date().toISOString()
  }

  return nextTask
}

function mergeAgentEvent(
  current: TaskAgentEventStream | null | undefined,
  event: TaskAgentEvent,
): TaskAgentEventStream {
  const base: TaskAgentEventStream = current ?? {
    taskId: event.taskId,
    items: [],
    nextSequence: 0,
  }

  if (base.items.some((currentEvent) => currentEvent.id === event.id)) {
    return base
  }

  const items = [...base.items, event].sort(
    (left, right) => left.sequence - right.sequence,
  )

  return {
    taskId: base.taskId || event.taskId,
    items,
    nextSequence: Math.max(base.nextSequence, event.sequence),
  }
}

class TaskSocketManager {
  private socket: Socket | null = null
  private queryClient: QueryClient | null = null
  private initialized = false
  private projectRefs = new Map<string, number>()
  private taskRefs = new Map<string, number>()
  private taskEventsRefs = new Map<string, number>()

  bindQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient
    this.ensureSocket()
  }

  subscribeProject(projectId: string) {
    const normalizedProjectId = projectId.trim()
    if (!normalizedProjectId) {
      return () => {}
    }

    this.ensureSocket()
    const current = this.projectRefs.get(normalizedProjectId) ?? 0
    this.projectRefs.set(normalizedProjectId, current + 1)

    if (current === 0) {
      this.socket?.emit("subscribe:project", {
        projectId: normalizedProjectId,
        limit: 200,
      })
    }

    return () => {
      const next = (this.projectRefs.get(normalizedProjectId) ?? 1) - 1
      if (next <= 0) {
        this.projectRefs.delete(normalizedProjectId)
        this.socket?.emit("unsubscribe:project", {
          projectId: normalizedProjectId,
        })
        return
      }

      this.projectRefs.set(normalizedProjectId, next)
    }
  }

  subscribeTask(taskId: string) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return () => {}
    }

    this.ensureSocket()
    const current = this.taskRefs.get(normalizedTaskId) ?? 0
    this.taskRefs.set(normalizedTaskId, current + 1)

    if (current === 0) {
      this.socket?.emit("subscribe:task", {
        taskId: normalizedTaskId,
      })
    }

    return () => {
      const next = (this.taskRefs.get(normalizedTaskId) ?? 1) - 1
      if (next <= 0) {
        this.taskRefs.delete(normalizedTaskId)
        this.socket?.emit("unsubscribe:task", {
          taskId: normalizedTaskId,
        })
        return
      }

      this.taskRefs.set(normalizedTaskId, next)
    }
  }

  subscribeTaskEvents(taskId: string) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return () => {}
    }

    this.ensureSocket()
    const current = this.taskEventsRefs.get(normalizedTaskId) ?? 0
    this.taskEventsRefs.set(normalizedTaskId, current + 1)

    if (current === 0) {
      const afterSequence =
        this.queryClient
          ?.getQueryData<TaskAgentEventStream | null>(
            taskQueryKeys.events(normalizedTaskId),
          )
          ?.items.at(-1)?.sequence ?? 0

      this.socket?.emit("subscribe:task-events", {
        taskId: normalizedTaskId,
        afterSequence,
        limit: 500,
      })
    }

    return () => {
      const next = (this.taskEventsRefs.get(normalizedTaskId) ?? 1) - 1
      if (next <= 0) {
        this.taskEventsRefs.delete(normalizedTaskId)
        this.socket?.emit("unsubscribe:task-events", {
          taskId: normalizedTaskId,
        })
        return
      }

      this.taskEventsRefs.set(normalizedTaskId, next)
    }
  }

  private ensureSocket() {
    if (this.socket) {
      return
    }

    this.socket = io(getTaskSocketBaseUrl(), {
      path: "/socket.io",
      autoConnect: true,
    })

    if (!this.initialized) {
      this.initialized = true
      this.registerHandlers()
    }
  }

  private registerHandlers() {
    if (!this.socket) {
      return
    }

    this.socket.on("connect", () => {
      for (const projectId of this.projectRefs.keys()) {
        this.socket?.emit("subscribe:project", { projectId, limit: 200 })
      }
      for (const taskId of this.taskRefs.keys()) {
        this.socket?.emit("subscribe:task", { taskId })
      }
      for (const taskId of this.taskEventsRefs.keys()) {
        const afterSequence =
          this.queryClient
            ?.getQueryData<TaskAgentEventStream | null>(taskQueryKeys.events(taskId))
            ?.items.at(-1)?.sequence ?? 0

        this.socket?.emit("subscribe:task-events", {
          taskId,
          afterSequence,
          limit: 500,
        })
      }
    })

    this.socket.on("project:task_upsert", (payload: ProjectTaskUpsertPayload) => {
      const task = normalizeTask(payload.task)
      if (!task || !this.queryClient) {
        return
      }

      this.queryClient.setQueryData<TaskListItem[] | undefined>(
        taskQueryKeys.list(payload.projectId),
        (current) => upsertTask(current, task),
      )

      this.queryClient.setQueryData<TaskDetail | null>(
        taskQueryKeys.detail(task.taskId),
        (current) => current ?? task,
      )
    })

    this.socket.on("task:ready", (payload: TaskReadyPayload) => {
      const task = normalizeTask(payload.task)
      if (!task || !this.queryClient) {
        return
      }

      this.queryClient.setQueryData(taskQueryKeys.detail(payload.taskId), task)
      this.queryClient.setQueryData<TaskListItem[] | undefined>(
        taskQueryKeys.list(task.projectId),
        (current) => upsertTask(current, task),
      )
    })

    this.socket.on("task:status", (payload: TaskStatusPayload) => {
      if (!this.queryClient) {
        return
      }

      this.queryClient.setQueryData<TaskDetail | null>(
        taskQueryKeys.detail(payload.taskId),
        (current) => (current ? patchTaskStatus(current, payload.status) : current),
      )
    })

    this.socket.on("task:end", (payload: TaskEndPayload) => {
      if (!this.queryClient) {
        return
      }

      this.queryClient.setQueryData<TaskDetail | null>(
        taskQueryKeys.detail(payload.taskId),
        (current) => (current ? patchTaskStatus(current, payload.status) : current),
      )

      void this.queryClient.invalidateQueries({
        queryKey: taskQueryKeys.diff(payload.taskId),
      })
    })

    this.socket.on("task-events:ready", (_payload: TaskEventsReadyPayload) => {})

    this.socket.on("task-events:item", (payload: TaskEventsItemPayload) => {
      if (!this.queryClient) {
        return
      }

      this.queryClient.setQueryData<TaskAgentEventStream | null>(
        taskQueryKeys.events(payload.taskId),
        (current) => mergeAgentEvent(current, payload.event),
      )
    })

    this.socket.on("subscription:error", (_payload: SubscriptionErrorPayload) => {})
  }
}

let manager: TaskSocketManager | null = null

export function getTaskSocketManager() {
  manager ??= new TaskSocketManager()
  return manager
}
