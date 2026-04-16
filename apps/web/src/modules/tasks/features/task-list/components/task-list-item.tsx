"use client"

import type { KeyboardEvent, MouseEvent, PointerEvent } from "react"
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
  onSelectTask: (id: string) => void
  onArchiveTask?: (id: string) => void
  onDeleteTask: (task: { id: string; title: string }) => void
}

type TaskListItemActionsProps = {
  archiveDisabled: boolean
  canManageTask: boolean
  className?: string
  deleteDisabled: boolean
  isArchived: boolean
  onArchiveTask?: (id: string) => void
  onDeleteTask: (task: { id: string; title: string }) => void
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
    dot: "bg-muted-foreground/50",
    line: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  },
  running: {
    dot: "bg-info",
    line: "bg-info",
    text: "text-info",
  },
  completed: {
    dot: "bg-success",
    line: "bg-success",
    text: "text-success",
  },
  failed: {
    dot: "bg-destructive",
    line: "bg-destructive",
    text: "text-destructive",
  },
  cancelled: {
    dot: "bg-warning",
    line: "bg-warning",
    text: "text-warning",
  },
  archived: {
    dot: "bg-muted-foreground/40",
    line: "bg-muted-foreground/40",
    text: "text-muted-foreground",
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
  const stopItemSelection = (
    event: MouseEvent<HTMLButtonElement> | PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "outline-none! h-6 w-6 rounded-full hover:bg-secondary hover:text-foreground",
            className,
          )}
          aria-label={`Task actions for ${taskTitle}`}
          onClick={stopItemSelection}
          onPointerDown={stopItemSelection}
        >
          <Trash2Icon className="text-destructive/55 size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!isArchived ? (
          <DropdownMenuItem
            disabled={!canManageTask || archiveDisabled}
            onClick={() => onArchiveTask?.(task.id)}
          >
            <ArchiveIcon className="mr-2 size-4" />
            Archive
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          disabled={!canManageTask || deleteDisabled}
          onClick={() => {
            onDeleteTask({
              id: task.id,
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
  const handleSelect = () => onSelectTask(task.id)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    event.preventDefault()
    onSelectTask(task.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={taskTitle}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "p-2 relative w-full flex flex-col gap-2 overflow-hidden rounded-md text-left outline-none transition-all focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
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
          <span className="text-muted-foreground/75">exec</span>
          <span className="max-w-full break-all text-foreground/80">
            {executorLabel}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-baseline gap-3">
          <span className="text-muted-foreground/75">mod</span>
          <span className="max-w-full break-all text-foreground/80">
            {modelLabel}
          </span>
        </span>
      </div>
    </div>

  )
}
