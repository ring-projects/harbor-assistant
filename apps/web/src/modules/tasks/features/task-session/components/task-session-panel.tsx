"use client"

import { useEffect, useMemo, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useOrchestrationDetailQuery } from "@/modules/orchestrations/hooks"
import {
  selectTaskEventStream,
  selectTaskDetail,
  useTasksSessionStore,
} from "@/modules/tasks/store"
import {
  STATUS_META,
  formatExecutorLabel,
  getErrorMessage,
  getTaskDisplayTitle,
} from "@/modules/tasks/view-models"
import {
  useTaskDetailQuery,
  useTaskEventStream,
  useTaskEventsQuery,
} from "@/modules/tasks/hooks/use-task-queries"

import { CHAT_STATUS_META } from "./shared"
import { TaskSessionComposerPane } from "./task-session-composer-pane"
import { TaskSessionConversationPane } from "./task-session-conversation-pane"

type TaskSessionPanelProps = {
  projectId: string
  orchestrationId: string | null
  taskId: string | null
  emptyStateMessage?: string
  showComposer?: boolean
}

function getRunningHint(executor: string | null | undefined) {
  if (!executor) {
    return "Agent is running..."
  }

  return `${formatExecutorLabel(executor)} is running...`
}

function parseTimeOrNull(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatElapsedShort(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

export function TaskSessionPanel({
  projectId,
  orchestrationId,
  taskId,
  emptyStateMessage = "Select a session to view activity.",
  showComposer = true,
}: TaskSessionPanelProps) {
  const orchestrationQuery = useOrchestrationDetailQuery(orchestrationId)
  const detailQuery = useTaskDetailQuery(taskId)
  const eventsQuery = useTaskEventsQuery({
    taskId,
    enabled: Boolean(taskId),
  })

  useTaskEventStream({
    projectId,
    taskId,
    enabled: Boolean(taskId),
  })
  const detail = useTasksSessionStore((state) =>
    selectTaskDetail(state, taskId),
  )
  const lastEventAt = useTasksSessionStore(
    (state) =>
      selectTaskEventStream(state, taskId)?.items.at(-1)?.createdAt ?? null,
  )
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (detail?.status !== "running") {
      return
    }

    const timerId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [detail?.status])

  const runningActivityMeta = useMemo(() => {
    if (detail?.status !== "running") {
      return null
    }

    const lastActivityMs =
      parseTimeOrNull(lastEventAt) ?? parseTimeOrNull(detail.startedAt)

    if (!lastActivityMs) {
      return {
        stale: false,
        label: "Waiting for first event...",
      }
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor((nowMs - lastActivityMs) / 1000),
    )
    const stale = elapsedSeconds >= 30
    const scope = lastEventAt ? "Last event" : "Started"

    return {
      stale,
      label: `${scope} ${formatElapsedShort(elapsedSeconds)} ago`,
    }
  }, [detail?.status, detail?.startedAt, lastEventAt, nowMs])
  const isLoading =
    Boolean(taskId) && (detailQuery.isLoading || eventsQuery.isLoading)
  const isError =
    Boolean(taskId) && (detailQuery.isError || eventsQuery.isError)
  const orchestration = orchestrationQuery.data ?? null
  const headerTitle = detail
    ? getTaskDisplayTitle({
        title: detail.title,
        prompt: detail.prompt,
      })
    : (orchestration?.title ?? emptyStateMessage)

  return (
    <section className="bg-card grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 space-y-2">
          <p
            className={cn(
              "text-md line-clamp-2 font-medium",
              detail || orchestration
                ? "text-foreground/85"
                : "text-muted-foreground font-mono text-[11px]",
            )}
          >
            {headerTitle}
          </p>
          {detail ? (
            <div className="text-muted-foreground flex items-center gap-2 font-mono text-[11px]">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5",
                  STATUS_META[detail.status].badgeClassName,
                )}
              >
                {STATUS_META[detail.status].label}
              </span>
              {detail.status === "running" ? (
                <span className="inline-flex items-center gap-2">
                  <span className="text-info inline-flex items-center gap-1.5">
                    <span className="size-1.5 animate-pulse rounded-full bg-current" />
                    {getRunningHint(detail.executor)}
                  </span>
                  {runningActivityMeta ? (
                    <span
                      className={cn(
                        runningActivityMeta.stale
                          ? "text-warning"
                          : "text-muted-foreground",
                      )}
                    >
                      {runningActivityMeta.label}
                      {runningActivityMeta.stale ? " · No recent updates" : ""}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {!taskId ? (
        <div className="text-muted-foreground bg-background/25 flex min-h-0 items-center justify-center rounded-lg font-mono text-[12px]">
          {emptyStateMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="min-h-0 space-y-3 overflow-auto">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <div className="bg-surface-danger text-destructive min-h-0 rounded-lg p-3 font-mono text-[12px]">
          {getErrorMessage(detailQuery.error ?? eventsQuery.error)}
        </div>
      ) : null}

      {taskId && !isLoading && !isError ? (
        <div
          className={cn(
            "grid min-h-0 gap-3 overflow-hidden",
            showComposer
              ? "grid-rows-[minmax(0,1fr)_auto]"
              : "grid-rows-[minmax(0,1fr)]",
          )}
        >
          <TaskSessionConversationPane taskId={taskId} detail={detail} />
          {showComposer ? (
            <TaskSessionComposerPane
              projectId={projectId}
              taskId={taskId}
              detail={detail}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
