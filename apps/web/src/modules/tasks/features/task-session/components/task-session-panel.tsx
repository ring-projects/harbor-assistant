"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  selectTaskDetail,
  useTasksSessionStore,
} from "@/modules/tasks/domain/store"
import {
  formatExecutorLabel,
  getTaskDisplayTitle,
} from "@/modules/tasks/domain/lib"
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
  taskId: string | null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Failed to load. Please try again."
}

export function TaskSessionPanel({ projectId, taskId }: TaskSessionPanelProps) {
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
  const isLoading =
    Boolean(taskId) && (detailQuery.isLoading || eventsQuery.isLoading)
  const isError =
    Boolean(taskId) && (detailQuery.isError || eventsQuery.isError)

  return (
    <section className="h-full min-h-0 min-w-0 overflow-hidden bg-transparent p-3">
      <div className="bg-muted/10 grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-2xl p-3">
        <div className="flex items-start justify-between gap-3 pb-3">
          <div className="min-w-0 space-y-1">
            {detail?.executor ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground bg-background/45 inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase">
                  {formatExecutorLabel(detail.executor)}
                </span>
              </div>
            ) : null}
            {detail ? (
              <p className="text-foreground/85 line-clamp-2 font-mono text-[12px] leading-5 break-words">
                {getTaskDisplayTitle({
                  title: detail.title,
                  prompt: detail.prompt,
                })}
              </p>
            ) : (
              <p className="text-muted-foreground font-mono text-[11px]">
                Select a task to inspect messages and agent activity.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {detail?.status ? (
              <span
                className={cn(
                  "inline-flex rounded-md px-2 py-0.5 font-mono text-[11px] shadow-none",
                  CHAT_STATUS_META[detail.status].badgeClassName,
                )}
              >
                {CHAT_STATUS_META[detail.status].label}
              </span>
            ) : null}

            {detail?.model ? (
              <span className="text-muted-foreground bg-background/35 hidden rounded-md px-2 py-0.5 font-mono text-[11px] xl:inline-flex">
                {detail.model}
              </span>
            ) : null}
          </div>
        </div>

        {!taskId ? (
          <div className="text-muted-foreground bg-background/25 flex min-h-0 items-center justify-center rounded-lg font-mono text-[12px]">
            Select a task from the left to view the chat.
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
          <div className="min-h-0 rounded-lg bg-rose-50 p-3 font-mono text-[12px] text-rose-700">
            {getErrorMessage(detailQuery.error ?? eventsQuery.error)}
          </div>
        ) : null}

        {taskId && !isLoading && !isError ? (
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden">
            <TaskSessionConversationPane taskId={taskId} detail={detail} />
            <TaskSessionComposerPane
              projectId={projectId}
              taskId={taskId}
              detail={detail}
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
