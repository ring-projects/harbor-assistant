"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"

import { getTaskWebSocketUrl } from "@/modules/tasks/api"
import type { TaskListItem } from "@/modules/tasks/contracts"

import { taskQueryKeys } from "./use-task-queries"

type ProjectTaskListEnvelope =
  | {
      type: "project_ready"
      projectId: string
    }
  | {
      type: "task_upsert"
      projectId: string
      task: Record<string, unknown>
    }
  | {
      type: "project_unsubscribed"
      projectId: string
    }
  | {
      type: "task_error"
      projectId?: string
      code: string
      message: string
    }
  | {
      type: "pong"
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

export function useProjectTaskListStream(args: {
  projectId: string
  enabled?: boolean
}) {
  const queryClient = useQueryClient()
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const shouldReconnectRef = useRef(false)

  useEffect(() => {
    if (!args.enabled) {
      shouldReconnectRef.current = false
      socketRef.current?.close()
      socketRef.current = null
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      return
    }

    shouldReconnectRef.current = true
    let disposed = false

    const openSocket = () => {
      const socket = new WebSocket(getTaskWebSocketUrl())
      socketRef.current = socket

      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({
            type: "subscribe_project",
            projectId: args.projectId,
            limit: 200,
          }),
        )
      })

      socket.addEventListener("message", (event) => {
        let payload: ProjectTaskListEnvelope | null = null

        try {
          payload = JSON.parse(String(event.data)) as ProjectTaskListEnvelope
        } catch {
          return
        }

        if (
          !payload ||
          ("projectId" in payload &&
            payload.projectId !== undefined &&
            payload.projectId !== args.projectId)
        ) {
          return
        }

        if (payload.type === "task_upsert") {
          const normalizedTask = normalizeTask(payload.task)
          if (!normalizedTask) {
            return
          }

          queryClient.setQueryData<TaskListItem[] | undefined>(
            taskQueryKeys.list(args.projectId),
            (current) => upsertTask(current, normalizedTask),
          )
        }
      })

      socket.addEventListener("close", () => {
        if (disposed || !shouldReconnectRef.current) {
          return
        }

        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null
          if (!disposed && shouldReconnectRef.current) {
            openSocket()
          }
        }, 1_500)
      })
    }

    openSocket()

    return () => {
      disposed = true
      shouldReconnectRef.current = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "unsubscribe_project",
            projectId: args.projectId,
          }),
        )
      }

      socketRef.current?.close()
      socketRef.current = null
    }
  }, [args.enabled, args.projectId, queryClient])
}
