"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  selectTaskDetail,
  useTasksSessionStore,
} from "@/modules/tasks/store"
import {
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
  taskId: string | null
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
    <section className="h-full min-h-0 min-w-0 overflow-hidden bg-card p-4 grid grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="flex items-start justify-between">
        {detail ? (
          <p className="text-foreground/85 line-clamp-2 text-md font-medium">
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
    </section>
  )
}
