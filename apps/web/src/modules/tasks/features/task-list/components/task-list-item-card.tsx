"use client"

import {
  ArchiveIcon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  STATUS_META,
  formatDateTime,
  formatExecutionModeLabel,
  formatExecutorLabel,
  getTaskDisplayTitle,
} from "@/modules/tasks/domain/lib"
import type { TaskListItem } from "@/modules/tasks/contracts"
import { cn } from "@/lib/utils"

type TaskListItemCardProps = {
  task: TaskListItem
  isActive: boolean
  isArchived?: boolean
  archiveDisabled?: boolean
  deleteDisabled?: boolean
  onSelectTask: (taskId: string) => void
  onArchiveTask?: (taskId: string) => void
  onDeleteTask: (task: { taskId: string; title: string }) => void
}

export function TaskListItemCard({
  task,
  isActive,
  isArchived = false,
  archiveDisabled = false,
  deleteDisabled = false,
  onSelectTask,
  onArchiveTask,
  onDeleteTask,
}: TaskListItemCardProps) {
  const canManageTask =
    task.status === "completed" ||
    task.status === "failed" ||
    task.status === "cancelled"
  const taskTitle = getTaskDisplayTitle({
    title: task.title,
    prompt: task.prompt,
  })

  return (
    <div
      className={cn(
        "w-full min-w-0 rounded-md border transition-colors",
        isArchived && "border-dashed",
        isActive ? "border-primary bg-primary/5" : "hover:border-muted-foreground/40",
      )}
    >
      <div className="flex min-w-0 items-start gap-2 p-3">
        <button
          type="button"
          onClick={() => onSelectTask(task.taskId)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            {isArchived ? (
              <span className="text-muted-foreground inline-flex rounded-full border px-2 py-0.5 text-[11px]">
                Archived
              </span>
            ) : (
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-[11px]",
                  STATUS_META[task.status].badgeClassName,
                )}
              >
                {STATUS_META[task.status].label}
              </span>
            )}
          </div>

          <p className="line-clamp-2 pt-2 text-sm font-medium break-words">
            {taskTitle}
          </p>

          {isArchived ? (
            <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 pt-2 text-[11px]">
              <span>Created: {formatDateTime(task.createdAt)}</span>
              <span>Archived: {formatDateTime(task.archivedAt)}</span>
              <span>Status: {STATUS_META[task.status].label}</span>
            </div>
          ) : (
            <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 pt-2 text-[11px]">
              <span>Created: {formatDateTime(task.createdAt)}</span>
              <span>Executor: {formatExecutorLabel(task.executor)}</span>
              <span>Mode: {formatExecutionModeLabel(task.executionMode)}</span>
              <span>Model: {task.model ?? "-"}</span>
            </div>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              aria-label={`Task actions for ${taskTitle}`}
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isArchived ? (
              <DropdownMenuItem
                disabled={!canManageTask || archiveDisabled}
                onClick={() => onArchiveTask?.(task.taskId)}
              >
                <ArchiveIcon className="mr-2 size-4" />
                Archive
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              disabled={!canManageTask || deleteDisabled}
              onClick={() => {
                onDeleteTask({
                  taskId: task.taskId,
                  title: taskTitle,
                })
              }}
            >
              <Trash2Icon className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
