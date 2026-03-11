"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"

import { getTaskWebSocketUrl, readTaskEvents } from "@/modules/tasks/api"
import {
  TERMINAL_TASK_STATUSES,
  type TaskAgentEvent,
  type TaskAgentEventStream,
  type TaskDetail,
  type TaskListItem,
  type TaskStatus,
} from "@/modules/tasks/contracts"

import { taskQueryKeys } from "./use-task-queries"

type TaskWsEnvelope =
  | {
      type: "ready"
      taskId: string
      cursor: number
      status?: TaskStatus
    }
  | {
      type: "agent_event"
      taskId: string
      event: TaskAgentEvent
    }
  | {
      type: "task_status"
      taskId: string
      status: TaskStatus
    }
  | {
      type: "task_end"
      taskId: string
      status: TaskStatus
      cursor: number
    }
  | {
      type: "task_error"
      taskId?: string
      code: string
      message: string
    }
  | {
      type: "pong"
    }
  | {
      type: "unsubscribed"
      taskId: string
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

function patchTaskStatus<T extends TaskDetail | TaskListItem>(
  task: T,
  status: TaskStatus,
): T {
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

  if (TERMINAL_TASK_STATUSES.includes(status)) {
    nextTask.finishedAt = task.finishedAt ?? new Date().toISOString()
  }

  return nextTask
}

function mergeMissingAgentEvents(
  current: TaskAgentEventStream | null | undefined,
  next: TaskAgentEventStream,
): TaskAgentEventStream {
  const eventById = new Map<string, TaskAgentEvent>()

  for (const event of current?.items ?? []) {
    eventById.set(event.id, event)
  }

  for (const event of next.items) {
    eventById.set(event.id, event)
  }

  const items = [...eventById.values()].sort(
    (left, right) => left.sequence - right.sequence,
  )

  return {
    taskId: next.taskId,
    items,
    nextSequence: Math.max(current?.nextSequence ?? 0, next.nextSequence),
  }
}

function isTerminalStatus(status: TaskStatus | null | undefined) {
  return Boolean(status && TERMINAL_TASK_STATUSES.includes(status))
}

export function useTaskEventStream(args: {
  projectId: string
  taskId: string | null
  enabled: boolean
}) {
  const queryClient = useQueryClient()
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const shouldReconnectRef = useRef(false)

  useEffect(() => {
    if (!args.enabled || !args.taskId) {
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

    const taskId = args.taskId
    let disposed = false

    const openSocket = () => {
      const socket = new WebSocket(getTaskWebSocketUrl())
      socketRef.current = socket

      socket.addEventListener("open", () => {
        const events = queryClient.getQueryData<TaskAgentEventStream | null>(
          taskQueryKeys.events(taskId),
        )
        const afterSequence = events?.items.at(-1)?.sequence ?? 0

        socket.send(
          JSON.stringify({
            type: "subscribe",
            taskId,
            afterSequence,
          }),
        )
      })

      socket.addEventListener("message", (event) => {
        let payload: TaskWsEnvelope | null = null

        try {
          payload = JSON.parse(String(event.data)) as TaskWsEnvelope
        } catch {
          return
        }

        if (
          !payload ||
          ("taskId" in payload &&
            payload.taskId !== undefined &&
            payload.taskId !== taskId)
        ) {
          return
        }

        if (payload.type === "agent_event") {
          const current = queryClient.getQueryData<TaskAgentEventStream | null>(
            taskQueryKeys.events(taskId),
          )
          const lastSequence = current?.items.at(-1)?.sequence ?? 0

          if (payload.event.sequence > lastSequence + 1) {
            void readTaskEvents({
              taskId,
              afterSequence: lastSequence,
              limit: 500,
            }).then((events) => {
              queryClient.setQueryData<TaskAgentEventStream | null>(
                taskQueryKeys.events(taskId),
                (existing) => mergeMissingAgentEvents(existing, events),
              )
            })
            return
          }

          queryClient.setQueryData<TaskAgentEventStream | null>(
            taskQueryKeys.events(taskId),
            (currentEvents) => mergeAgentEvent(currentEvents, payload.event),
          )
          return
        }

        if (payload.type === "task_status" || payload.type === "task_end") {
          const nextStatus = payload.status

          queryClient.setQueryData<TaskDetail | null>(
            taskQueryKeys.detail(taskId),
            (currentTask) =>
              currentTask ? patchTaskStatus(currentTask, nextStatus) : currentTask,
          )

          queryClient.setQueryData<TaskListItem[] | undefined>(
            taskQueryKeys.list(args.projectId),
            (currentTasks) =>
              currentTasks?.map((task) =>
                task.taskId === taskId ? patchTaskStatus(task, nextStatus) : task,
              ),
          )

          if (payload.type === "task_end") {
            void queryClient.invalidateQueries({
              queryKey: taskQueryKeys.diff(taskId),
            })
            shouldReconnectRef.current = false
            socket.close()
          }
          return
        }

        if (payload.type === "task_error") {
          shouldReconnectRef.current = true
        }
      })

      socket.addEventListener("close", () => {
        if (disposed || !shouldReconnectRef.current) {
          return
        }

        const detail = queryClient.getQueryData<TaskDetail | null>(
          taskQueryKeys.detail(taskId),
        )

        if (isTerminalStatus(detail?.status)) {
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
        socketRef.current.send(JSON.stringify({ type: "unsubscribe", taskId }))
      }
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [args.enabled, args.projectId, args.taskId, queryClient])
}
