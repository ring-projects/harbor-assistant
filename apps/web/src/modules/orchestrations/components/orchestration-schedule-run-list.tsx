"use client"

import { useEffect, useMemo } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTimeShort } from "@/lib/date-time"
import { cn } from "@/lib/utils"
import { useOrchestrationTaskListQuery } from "@/modules/tasks/hooks/use-task-queries"
import type { TaskListItem } from "@/modules/tasks/contracts"
import {
  STATUS_META,
  getErrorMessage,
  getTaskDisplayTitle,
} from "@/modules/tasks/view-models"

type OrchestrationScheduleRunListProps = {
  orchestrationId: string
  selectedTaskId: string | null
  onSelectTask: (taskId: string | null) => void
}

function getTaskTimestamp(task: TaskListItem) {
  return task.finishedAt ?? task.startedAt ?? task.createdAt
}

function sortTasksByLatest(tasks: TaskListItem[]) {
  return [...tasks].sort((left, right) => {
    const leftTimestamp = Date.parse(getTaskTimestamp(left)) || 0
    const rightTimestamp = Date.parse(getTaskTimestamp(right)) || 0

    return rightTimestamp - leftTimestamp
  })
}

export function OrchestrationScheduleRunList({
  orchestrationId,
  selectedTaskId,
  onSelectTask,
}: OrchestrationScheduleRunListProps) {
  const query = useOrchestrationTaskListQuery({
    orchestrationId,
  })
  const tasks = useMemo(() => sortTasksByLatest(query.data ?? []), [query.data])

  const resolvedSelectedTaskId = useMemo(() => {
    if (tasks.length === 0) {
      return null
    }

    if (selectedTaskId && tasks.some((task) => task.id === selectedTaskId)) {
      return selectedTaskId
    }

    return tasks[0]?.id ?? null
  }, [selectedTaskId, tasks])

  useEffect(() => {
    if (resolvedSelectedTaskId !== selectedTaskId) {
      onSelectTask(resolvedSelectedTaskId)
    }
  }, [onSelectTask, resolvedSelectedTaskId, selectedTaskId])

  return (
    <section className="bg-background h-full min-h-0 p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Runs</p>
          <p className="text-muted-foreground text-xs">
            Execution history for this schedule.
          </p>
        </div>

        <div className="native-thin-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-1.5 pb-3">
            {query.isLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 rounded-lg" />
                ))
              : null}

            {!query.isLoading && query.isError ? (
              <div className="bg-surface-danger text-destructive border-destructive/25 rounded-md border p-3 text-xs">
                {getErrorMessage(query.error)}
              </div>
            ) : null}

            {!query.isLoading && !query.isError && tasks.length === 0 ? (
              <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                No runs yet.
              </div>
            ) : null}

            {!query.isLoading && !query.isError
              ? tasks.map((task) => {
                  const isActive = task.id === resolvedSelectedTaskId
                  const title = getTaskDisplayTitle({
                    title: task.title,
                    prompt: task.prompt,
                  })
                  const statusMeta = STATUS_META[task.status]

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onSelectTask(task.id)}
                      className={cn(
                        "focus-visible:ring-foreground/20 w-full rounded-lg px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        isActive
                          ? "bg-secondary"
                          : "bg-card/78 hover:bg-accent/72",
                      )}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              statusMeta.badgeClassName,
                            )}
                          >
                            {statusMeta.label}
                          </span>
                          <span className="text-muted-foreground text-[11px] font-semibold">
                            {formatRelativeTimeShort(getTaskTimestamp(task))}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <p className="line-clamp-2 text-sm font-semibold">
                            {title}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {task.executor ?? "-"} · {task.model ?? "-"}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })
              : null}
          </div>
        </div>
      </div>
    </section>
  )
}
