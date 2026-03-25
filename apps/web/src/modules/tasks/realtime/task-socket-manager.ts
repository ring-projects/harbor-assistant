"use client"

import type { QueryClient } from "@tanstack/react-query"
import { io, type Socket } from "socket.io-client"

import { gitQueryKeys } from "@/modules/git"
import {
  selectLastSequence,
  useTasksSessionStore,
} from "@/modules/tasks/domain/store"
import { getTaskSocketBaseUrl } from "@/modules/tasks/api"
import type {
  TaskAgentEvent,
  TaskListItem,
  TaskStatus,
} from "@/modules/tasks/contracts"

type InteractionTopic =
  | {
      kind: "project"
      id: string
    }
  | {
      kind: "task"
      id: string
    }
  | {
      kind: "task-events"
      id: string
    }
  | {
      kind: "project-git"
      id: string
    }

type InteractionSubscribeRequest = {
  topic: InteractionTopic
  afterSequence?: number
  limit?: number
}

type InteractionMessageEnvelope = {
  topic?: InteractionTopic
  message?: {
    kind: "subscribed" | "unsubscribed"
  }
} | {
  topic?: InteractionTopic
  message?: {
    kind: "snapshot"
    name: "project_tasks" | "task" | "task_events"
    data?: Record<string, unknown>
  }
} | {
  topic?: InteractionTopic
  message?: {
    kind: "event"
    name:
      | "task_upsert"
      | "task_deleted"
      | "task_status_changed"
      | "task_ended"
      | "task_event"
      | "project_git_changed"
    data?: Record<string, unknown>
  }
} | {
  topic?: InteractionTopic
  message?: {
    kind: "error"
    error?: {
      code?: string
      message?: string
    }
  }
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function toStringOrEmpty(value: unknown) {
  return typeof value === "string" ? value : ""
}

function toOptionalDateString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function toTaskStatus(value: unknown): TaskStatus | null {
  return value === "queued" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
    ? value
    : null
}

function normalizeTask(input: Record<string, unknown>): TaskListItem | null {
  const taskId = toStringOrNull(input.taskId) ?? toStringOrNull(input.id)
  const projectId = toStringOrNull(input.projectId)
  const status = toTaskStatus(input.status)

  if (!taskId || !projectId || !status) {
    return null
  }

  return {
    taskId,
    projectId,
    prompt: toStringOrEmpty(input.prompt),
    title: toStringOrEmpty(input.title),
    titleSource:
      input.titleSource === "agent" || input.titleSource === "user"
        ? input.titleSource
        : "prompt",
    model: toStringOrNull(input.model),
    executor: toStringOrNull(input.executor),
    executionMode:
      input.executionMode === "safe" ||
      input.executionMode === "connected" ||
      input.executionMode === "full-access"
        ? input.executionMode
        : null,
    status,
    archivedAt: toOptionalDateString(input.archivedAt),
    createdAt: toStringOrNull(input.createdAt) ?? new Date().toISOString(),
    startedAt: toOptionalDateString(input.startedAt),
    finishedAt: toOptionalDateString(input.finishedAt),
  }
}

function normalizeTaskEvent(
  taskId: string,
  input: Record<string, unknown>,
): TaskAgentEvent | null {
  const id = toStringOrNull(input.id)
  const eventType = toStringOrNull(input.eventType)
  const createdAt = toStringOrNull(input.createdAt)
  const sequence =
    typeof input.sequence === "number" && Number.isInteger(input.sequence)
      ? input.sequence
      : null
  const payload = asRecord(input.payload)

  if (!id || !eventType || !createdAt || sequence === null || !payload) {
    return null
  }

  return {
    id,
    taskId,
    sequence,
    eventType,
    payload,
    createdAt,
  }
}

export class TaskSocketManager {
  private socket: Socket | null = null
  private queryClient: QueryClient | null = null
  private initialized = false
  private projectRefs = new Map<string, number>()
  private projectGitRefs = new Map<string, number>()
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
      this.emitSubscribe({
        topic: {
          kind: "project",
          id: normalizedProjectId,
        },
        limit: 200,
      })
    }

    return () => {
      const next = (this.projectRefs.get(normalizedProjectId) ?? 1) - 1
      if (next <= 0) {
        this.projectRefs.delete(normalizedProjectId)
        this.emitUnsubscribe({
          topic: {
            kind: "project",
            id: normalizedProjectId,
          },
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
      this.emitSubscribe({
        topic: {
          kind: "task",
          id: normalizedTaskId,
        },
      })
    }

    return () => {
      const next = (this.taskRefs.get(normalizedTaskId) ?? 1) - 1
      if (next <= 0) {
        this.taskRefs.delete(normalizedTaskId)
        this.emitUnsubscribe({
          topic: {
            kind: "task",
            id: normalizedTaskId,
          },
        })
        return
      }

      this.taskRefs.set(normalizedTaskId, next)
    }
  }

  subscribeProjectGit(projectId: string) {
    const normalizedProjectId = projectId.trim()
    if (!normalizedProjectId) {
      return () => {}
    }

    this.ensureSocket()
    const current = this.projectGitRefs.get(normalizedProjectId) ?? 0
    this.projectGitRefs.set(normalizedProjectId, current + 1)

    if (current === 0) {
      this.emitSubscribe({
        topic: {
          kind: "project-git",
          id: normalizedProjectId,
        },
      })
    }

    return () => {
      const next = (this.projectGitRefs.get(normalizedProjectId) ?? 1) - 1
      if (next <= 0) {
        this.projectGitRefs.delete(normalizedProjectId)
        this.emitUnsubscribe({
          topic: {
            kind: "project-git",
            id: normalizedProjectId,
          },
        })
        return
      }

      this.projectGitRefs.set(normalizedProjectId, next)
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
      this.emitSubscribe({
        topic: {
          kind: "task-events",
          id: normalizedTaskId,
        },
        afterSequence: selectLastSequence(
          useTasksSessionStore.getState(),
          normalizedTaskId,
        ),
        limit: 500,
      })
    }

    return () => {
      const next = (this.taskEventsRefs.get(normalizedTaskId) ?? 1) - 1
      if (next <= 0) {
        this.taskEventsRefs.delete(normalizedTaskId)
        this.emitUnsubscribe({
          topic: {
            kind: "task-events",
            id: normalizedTaskId,
          },
        })
        return
      }

      this.taskEventsRefs.set(normalizedTaskId, next)
    }
  }

  private emitSubscribe(payload: InteractionSubscribeRequest) {
    this.socket?.emit("interaction:subscribe", payload)
  }

  private emitUnsubscribe(payload: InteractionSubscribeRequest) {
    this.socket?.emit("interaction:unsubscribe", payload)
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
        this.emitSubscribe({
          topic: {
            kind: "project",
            id: projectId,
          },
          limit: 200,
        })
      }
      for (const projectId of this.projectGitRefs.keys()) {
        this.emitSubscribe({
          topic: {
            kind: "project-git",
            id: projectId,
          },
        })
      }
      for (const taskId of this.taskRefs.keys()) {
        this.emitSubscribe({
          topic: {
            kind: "task",
            id: taskId,
          },
        })
      }
      for (const taskId of this.taskEventsRefs.keys()) {
        this.emitSubscribe({
          topic: {
            kind: "task-events",
            id: taskId,
          },
          afterSequence: selectLastSequence(useTasksSessionStore.getState(), taskId),
          limit: 500,
        })
      }
    })

    this.socket.on("interaction:message", (payload: InteractionMessageEnvelope) => {
      const topic = payload?.topic
      const message = payload?.message
      if (!topic || !message) {
        return
      }

      if (message.kind === "snapshot") {
        this.handleSnapshot(topic, message.name, message.data ?? {})
        return
      }

      if (message.kind === "event") {
        this.handleEvent(topic, message.name, message.data ?? {})
      }
    })
  }

  private handleSnapshot(
    topic: InteractionTopic,
    name: "project_tasks" | "task" | "task_events",
    data: Record<string, unknown>,
  ) {
    switch (name) {
      case "project_tasks": {
        if (topic.kind !== "project") {
          return
        }

        const tasks = Array.isArray(data.tasks)
          ? data.tasks
              .map((task) => normalizeTask(asRecord(task) ?? {}))
              .filter((task): task is TaskListItem => task !== null)
          : []

        useTasksSessionStore.getState().hydrateProjectTasks(topic.id, tasks)
        return
      }
      case "task": {
        const task = normalizeTask(asRecord(data.task) ?? {})
        if (!task) {
          return
        }

        useTasksSessionStore.getState().applyTaskUpsert(task)
        return
      }
      case "task_events": {
        if (topic.kind !== "task-events") {
          return
        }

        const items = Array.isArray(data.items)
          ? data.items
              .map((event) => normalizeTaskEvent(topic.id, asRecord(event) ?? {}))
              .filter((event): event is TaskAgentEvent => event !== null)
          : []
        const nextSequence =
          typeof data.nextSequence === "number" && Number.isInteger(data.nextSequence)
            ? data.nextSequence
            : items.at(-1)?.sequence ?? 0

        useTasksSessionStore.getState().hydrateTaskEvents(topic.id, {
          taskId: topic.id,
          items,
          nextSequence,
        })
      }
    }
  }

  private handleEvent(
    topic: InteractionTopic,
    name:
      | "task_upsert"
      | "task_deleted"
      | "task_status_changed"
      | "task_ended"
      | "task_event"
      | "project_git_changed",
    data: Record<string, unknown>,
  ) {
    switch (name) {
      case "task_upsert": {
        const task = normalizeTask(asRecord(data.task) ?? {})
        if (!task) {
          return
        }

        useTasksSessionStore.getState().applyTaskUpsert(task)
        return
      }
      case "task_deleted": {
        const taskId = toStringOrNull(data.taskId)
        const projectId =
          toStringOrNull(data.projectId) ??
          (topic.kind === "project" ? topic.id : null)

        if (!taskId || !projectId) {
          return
        }

        useTasksSessionStore.getState().deleteTask(projectId, taskId)
        return
      }
      case "task_status_changed": {
        if (topic.kind !== "task") {
          return
        }

        const status = toTaskStatus(data.status)
        if (!status) {
          return
        }

        useTasksSessionStore.getState().applyTaskStatus(topic.id, status)
        return
      }
      case "task_ended": {
        if (topic.kind !== "task" && topic.kind !== "task-events") {
          return
        }

        const status = toTaskStatus(data.status)
        if (!status) {
          return
        }

        useTasksSessionStore.getState().applyTaskEnd(topic.id, status)

        const currentTask = useTasksSessionStore.getState().tasksById[topic.id]
        if (!this.queryClient) {
          return
        }

        if (currentTask?.projectId) {
          void this.queryClient.invalidateQueries({
            queryKey: gitQueryKeys.byProject(currentTask.projectId),
          })
          return
        }

        void this.queryClient.invalidateQueries({
          queryKey: gitQueryKeys.all,
        })
        return
      }
      case "task_event": {
        if (topic.kind !== "task-events") {
          return
        }

        const event = normalizeTaskEvent(topic.id, asRecord(data.event) ?? {})
        if (!event) {
          return
        }

        useTasksSessionStore.getState().applyAgentEvent(topic.id, event)
        return
      }
      case "project_git_changed": {
        if (topic.kind !== "project-git" || !this.queryClient) {
          return
        }

        void this.queryClient.invalidateQueries({
          queryKey: gitQueryKeys.byProject(topic.id),
        })
      }
    }
  }
}

let manager: TaskSocketManager | null = null

export function getTaskSocketManager() {
  manager ??= new TaskSocketManager()
  return manager
}
