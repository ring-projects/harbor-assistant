"use client"

import type { QueryClient } from "@tanstack/react-query"
import { io, type Socket } from "socket.io-client"

import {
  selectLastSequence,
  useTasksSessionStore,
} from "@/modules/tasks/domain/store"
import { gitQueryKeys } from "@/modules/git"
import { getTaskSocketBaseUrl } from "@/modules/tasks/api"
import type {
  TaskAgentEvent,
  TaskListItem,
  TaskStatus,
} from "@/modules/tasks/contracts"

type ProjectTaskUpsertPayload = {
  projectId: string
  task: Record<string, unknown>
}

type ProjectTaskDeletedPayload = {
  projectId: string
  taskId: string
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

type ProjectGitChangedPayload = {
  projectId: string
  changedAt: string
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

function toOptionalDateString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function toExecutionMode(
  value: unknown,
): "safe" | "connected" | "full-access" | null {
  return value === "safe" ||
    value === "connected" ||
    value === "full-access"
    ? value
    : null
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
    title: toStringOrEmpty(input.title),
    titleSource:
      input.titleSource === "agent" || input.titleSource === "user"
        ? input.titleSource
        : "prompt",
    titleUpdatedAt: toOptionalDateString(input.titleUpdatedAt),
    model: toStringOrNull(input.model),
    executor: toStringOrNull(input.executor) ?? "codex",
    executionMode: toExecutionMode(input.executionMode),
    status,
    threadId: toStringOrNull(input.threadId),
    parentTaskId: toStringOrNull(input.parentTaskId),
    archivedAt: toOptionalDateString(input.archivedAt),
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

  subscribeProjectGit(projectId: string) {
    const normalizedProjectId = projectId.trim()
    if (!normalizedProjectId) {
      return () => {}
    }

    this.ensureSocket()
    const current = this.projectGitRefs.get(normalizedProjectId) ?? 0
    this.projectGitRefs.set(normalizedProjectId, current + 1)

    if (current === 0) {
      this.socket?.emit("subscribe:project-git", {
        projectId: normalizedProjectId,
      })
    }

    return () => {
      const next = (this.projectGitRefs.get(normalizedProjectId) ?? 1) - 1
      if (next <= 0) {
        this.projectGitRefs.delete(normalizedProjectId)
        this.socket?.emit("unsubscribe:project-git", {
          projectId: normalizedProjectId,
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
      const afterSequence =
        selectLastSequence(useTasksSessionStore.getState(), normalizedTaskId)

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
      for (const projectId of this.projectGitRefs.keys()) {
        this.socket?.emit("subscribe:project-git", { projectId })
      }
      for (const taskId of this.taskRefs.keys()) {
        this.socket?.emit("subscribe:task", { taskId })
      }
      for (const taskId of this.taskEventsRefs.keys()) {
        const afterSequence = selectLastSequence(useTasksSessionStore.getState(), taskId)

        this.socket?.emit("subscribe:task-events", {
          taskId,
          afterSequence,
          limit: 500,
        })
      }
    })

    this.socket.on("project:task_upsert", (payload: ProjectTaskUpsertPayload) => {
      const task = normalizeTask(payload.task)
      if (!task) {
        return
      }

      useTasksSessionStore.getState().applyTaskUpsert(task)
    })

    this.socket.on("project:task_deleted", (payload: ProjectTaskDeletedPayload) => {
      useTasksSessionStore.getState().deleteTask(payload.projectId, payload.taskId)
    })

    this.socket.on("task:ready", (payload: TaskReadyPayload) => {
      const task = normalizeTask(payload.task)
      if (!task) {
        return
      }

      useTasksSessionStore.getState().applyTaskUpsert(task)
    })

    this.socket.on("task:status", (payload: TaskStatusPayload) => {
      useTasksSessionStore.getState().applyTaskStatus(payload.taskId, payload.status)
    })

    this.socket.on("task:end", (payload: TaskEndPayload) => {
      useTasksSessionStore.getState().applyTaskEnd(payload.taskId, payload.status)

      const currentTask = useTasksSessionStore
        .getState()
        .tasksById[payload.taskId]

      if (!this.queryClient) {
        return
      }
      if (currentTask?.projectId) {
        void this.queryClient.invalidateQueries({
          queryKey: gitQueryKeys.byProject(currentTask.projectId),
        })
      } else {
        void this.queryClient.invalidateQueries({
          queryKey: gitQueryKeys.all,
        })
      }
    })

    this.socket.on("task-events:ready", (_payload: TaskEventsReadyPayload) => {})

    this.socket.on("task-events:item", (payload: TaskEventsItemPayload) => {
      useTasksSessionStore.getState().applyAgentEvent(payload.taskId, payload.event)
    })

    this.socket.on("project:git_changed", (payload: ProjectGitChangedPayload) => {
      if (!this.queryClient || !payload.projectId?.trim()) {
        return
      }

      void this.queryClient.invalidateQueries({
        queryKey: gitQueryKeys.byProject(payload.projectId),
      })
    })

    this.socket.on("subscription:error", (_payload: SubscriptionErrorPayload) => {})
  }
}

let manager: TaskSocketManager | null = null

export function getTaskSocketManager() {
  manager ??= new TaskSocketManager()
  return manager
}
