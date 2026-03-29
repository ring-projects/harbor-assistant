"use client"

import {
  ArchiveIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { TaskListItem as TaskListItemRecord } from "@/modules/tasks/contracts"
import {
  STATUS_META,
  formatExecutorLabel,
  getTaskDisplayTitle,
} from "@/modules/tasks/view-models"
import { formatRelativeTimeShort } from "@/lib/date-time"
import { cn } from "@/lib/utils"

type TaskListItemProps = {
  task: TaskListItemRecord
  isActive: boolean
  isArchived?: boolean
  archiveDisabled?: boolean
  deleteDisabled?: boolean
  onSelectTask: (taskId: string) => void
  onArchiveTask?: (taskId: string) => void
  onDeleteTask: (task: { taskId: string; title: string }) => void
}

type TaskListItemActionsProps = {
  archiveDisabled: boolean
  canManageTask: boolean
  className?: string
  deleteDisabled: boolean
  isArchived: boolean
  onArchiveTask?: (taskId: string) => void
  onDeleteTask: (task: { taskId: string; title: string }) => void
  task: TaskListItemRecord
  taskTitle: string
}

const TASK_STATUS_ACCENT_CLASS_NAME: Record<
  TaskListItemRecord["status"] | "archived",
  {
    dot: string
    line: string
    text: string
  }
> = {
  queued: {
    dot: "bg-slate-400",
    line: "bg-slate-400",
    text: "text-slate-600",
  },
  running: {
    dot: "bg-sky-500",
    line: "bg-sky-500",
    text: "text-sky-600",
  },
  completed: {
    dot: "bg-emerald-500",
    line: "bg-emerald-500",
    text: "text-emerald-600",
  },
  failed: {
    dot: "bg-rose-500",
    line: "bg-rose-500",
    text: "text-rose-600",
  },
  cancelled: {
    dot: "bg-amber-500",
    line: "bg-amber-500",
    text: "text-amber-600",
  },
  archived: {
    dot: "bg-zinc-400",
    line: "bg-zinc-400",
    text: "text-zinc-500",
  },
}

function TaskListItemActions({
  archiveDisabled,
  canManageTask,
  className,
  deleteDisabled,
  isArchived,
  onArchiveTask,
  onDeleteTask,
  task,
  taskTitle,
}: TaskListItemActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 hover:text-slate-700 outline-none!",
            className,
          )}
          aria-label={`Task actions for ${taskTitle}`}
        >
          <Trash2Icon className="size-4 text-red-500/50" />
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
  )
}

export function TaskListItem({
  task,
  isActive,
  isArchived = false,
  archiveDisabled = false,
  deleteDisabled = false,
  onSelectTask,
  onArchiveTask,
  onDeleteTask,
}: TaskListItemProps) {
  const canManageTask =
    task.status === "completed" ||
    task.status === "failed" ||
    task.status === "cancelled"
  const taskTitle = getTaskDisplayTitle({
    title: task.title,
    prompt: task.prompt,
  })
  const displayStatus = isArchived ? "archived" : task.status
  const statusMeta = STATUS_META[displayStatus]
  const statusAccent = TASK_STATUS_ACCENT_CLASS_NAME[displayStatus]
  const timestamp = isArchived
    ? task.archivedAt
    : task.finishedAt ?? task.startedAt ?? task.createdAt
  const executorLabel = formatExecutorLabel(task.executor)
  const modelLabel = task.model?.trim() || "-"

  return (
    <button
      type="button"
      onClick={() => onSelectTask(task.taskId)}
      className={cn(
        "p-2 relative w-full flex flex-col gap-2 overflow-hidden rounded-md transition-all",
        isArchived && "border border-dashed",
        isActive
          ? "bg-primary/10"
          : "border-border/60 hover:border-muted-foreground/20",
      )}
    >
      {/** header */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold uppercase",
            statusAccent.text,
          )}
        >
          <span
            className={cn("size-3 shrink-0 rounded-full", statusAccent.dot)}
          />
          {statusMeta.label}
        </span>
        <div className="inline-flex items-center gap-1">
          <span className="text-muted-foreground/80 text-xs font-semibold">
            {formatRelativeTimeShort(timestamp)}
          </span>
          <TaskListItemActions
            className="self-end"
            task={task}
            taskTitle={taskTitle}
            isArchived={isArchived}
            canManageTask={canManageTask}
            archiveDisabled={archiveDisabled}
            deleteDisabled={deleteDisabled}
            onArchiveTask={onArchiveTask}
            onDeleteTask={onDeleteTask}
          />
        </div>
      </div>

      <p className="line-clamp-2 text-left text-sm wrap-break-words">
        {taskTitle}
      </p>

      <div className="text-muted-foreground grid grid-cols-3 text-xs">
        <span className="inline-flex min-w-0 items-baseline gap-3">
          <span className="text-slate-400">exec</span>
          <span className="max-w-full break-all text-slate-700">
            {executorLabel}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-baseline gap-3">
          <span className="text-slate-400">mod</span>
          <span className="max-w-full break-all text-slate-700">
            {modelLabel}
          </span>
        </span>
      </div>
    </button>

  )
}
