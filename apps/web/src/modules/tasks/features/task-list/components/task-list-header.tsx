"use client"

import { MoreHorizontalIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TaskCreateDialog } from "@/modules/tasks/features/task-create"

export type TaskListTab = "all" | "running" | "completed" | "archived"

type TaskListHeaderProps = {
  allCount: number
  archivedCount: number
  completedCount: number
  onSelectTab: (tab: TaskListTab) => void
  onTaskCreated: (taskId: string) => void
  projectId: string
  runningCount: number
  selectedTab: TaskListTab
}

export function TaskListHeader({
  allCount,
  archivedCount,
  completedCount,
  onTaskCreated,
  projectId,
  runningCount,
  onSelectTab,
  selectedTab,
}: TaskListHeaderProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <TaskCreateDialog
        projectId={projectId}
        onTaskCreated={onTaskCreated}
        trigger={
          <Button type="button" size="sm" className="shrink-0">
            <PlusIcon className="size-4" />
            New Task
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={selectedTab === "all" ? "ghost" : "secondary"}
            size="icon-sm"
            className="shrink-0"
            aria-label="Task filters"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onSelectTab("all")}>
            All ({allCount})
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelectTab("running")}>
            Running ({runningCount})
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelectTab("completed")}>
            Completed ({completedCount})
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelectTab("archived")}>
            Archived ({archivedCount})
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>


    </div>
  )
}
