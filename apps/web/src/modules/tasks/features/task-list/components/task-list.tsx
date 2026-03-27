"use client"

import { MoreHorizontalIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  selectProjectTasks,
  useTasksSessionStore,
} from "@/modules/tasks/domain/store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useArchiveTaskMutation,
  useDeleteTaskMutation,
  useProjectTaskListStream,
  useTaskListQuery,
} from "@/modules/tasks/hooks/use-task-queries"
import { getErrorMessage } from "@/modules/tasks/domain/lib"
import { TaskCreateDialog } from "@/modules/tasks/features/task-create"
import { TaskListItemCard } from "./task-list-item-card"

type TaskListProps = {
  projectId: string
  selectedTaskId: string | null
  onSelectTask: (taskId: string | null) => void
}

type TaskListTab = "all" | "running" | "completed" | "archived"

export function TaskList({
  projectId,
  selectedTaskId,
  onSelectTask,
}: TaskListProps) {
  const [taskActionError, setTaskActionError] = useState<string | null>(null)
  const [taskPendingDelete, setTaskPendingDelete] = useState<{
    taskId: string
    title: string
  } | null>(null)

  const archiveTaskMutation = useArchiveTaskMutation(projectId)
  const deleteTaskMutation = useDeleteTaskMutation(projectId)
  const listQuery = useTaskListQuery({
    projectId,
  })
  useProjectTaskListStream({
    projectId,
    enabled: true,
  })

  const allTasks = useTasksSessionStore((state) =>
    selectProjectTasks(state, projectId),
  )
  const [selectedTab, setSelectedTab] = useState<TaskListTab>("all")

  const activeTasks = useMemo(
    () => allTasks.filter((task) => task.archivedAt === null),
    [allTasks],
  )
  const archivedTasks = useMemo(
    () => allTasks.filter((task) => task.archivedAt !== null),
    [allTasks],
  )
  const runningTasks = useMemo(
    () =>
      activeTasks.filter(
        (task) => task.status === "queued" || task.status === "running",
      ),
    [activeTasks],
  )
  const completedTasks = useMemo(
    () =>
      activeTasks.filter(
        (task) =>
          task.status === "completed" ||
          task.status === "failed" ||
          task.status === "cancelled",
      ),
    [activeTasks],
  )
  const visibleTasks = useMemo(() => {
    switch (selectedTab) {
      case "all":
        return allTasks
      case "completed":
        return completedTasks
      case "archived":
        return archivedTasks
      case "running":
      default:
        return runningTasks
    }
  }, [allTasks, archivedTasks, completedTasks, runningTasks, selectedTab])

  const resolvedSelectedTaskId = useMemo(() => {
    if (visibleTasks.length === 0) {
      return null
    }

    if (
      selectedTaskId &&
      visibleTasks.some((task) => task.taskId === selectedTaskId)
    ) {
      return selectedTaskId
    }

    return visibleTasks[0]?.taskId ?? null
  }, [selectedTaskId, visibleTasks])

  const emptyStateMessage = useMemo(() => {
    if (allTasks.length === 0) {
      return "No tasks yet."
    }

    switch (selectedTab) {
      case "all":
        return "No tasks yet."
      case "completed":
        return "No completed tasks yet."
      case "archived":
        return "No archived tasks yet."
      case "running":
      default:
        return "No running tasks right now."
    }
  }, [allTasks.length, selectedTab])

  useEffect(() => {
    if (resolvedSelectedTaskId !== selectedTaskId) {
      onSelectTask(resolvedSelectedTaskId)
    }
  }, [onSelectTask, resolvedSelectedTaskId, selectedTaskId])

  async function handleArchiveTask(taskId: string) {
    try {
      setTaskActionError(null)
      await archiveTaskMutation.mutateAsync(taskId)
    } catch (error) {
      setTaskActionError(getErrorMessage(error))
    }
  }

  async function handleDeleteTask() {
    if (!taskPendingDelete) {
      return
    }

    try {
      setTaskActionError(null)
      await deleteTaskMutation.mutateAsync(taskPendingDelete.taskId)
      setTaskPendingDelete(null)
    } catch (error) {
      setTaskActionError(getErrorMessage(error))
    }
  }

  return (
    <section className="min-h-0 bg-transparent p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Tabs
            value={selectedTab}
            onValueChange={(value) => {
              if (
                value === "all" ||
                value === "running" ||
                value === "completed"
              ) {
                setSelectedTab(value)
              }
            }}
            className="min-w-0 items-center"
          >
            <TabsList className="h-8">
              <TabsTrigger value="all" className="px-3 text-xs">
                All
                <span className="text-muted-foreground">{allTasks.length}</span>
              </TabsTrigger>
              <TabsTrigger value="running" className="px-3 text-xs">
                Running
                <span className="text-muted-foreground">{runningTasks.length}</span>
              </TabsTrigger>
              <TabsTrigger value="completed" className="px-3 text-xs">
                Completed
                <span className="text-muted-foreground">{completedTasks.length}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center justify-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant={selectedTab === "archived" ? "secondary" : "ghost"}
                  size="icon-sm"
                  className="shrink-0"
                  aria-label="More task filters"
                >
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSelectedTab("archived")}>
                  Archived ({archivedTasks.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <TaskCreateDialog
              projectId={projectId}
              onTaskCreated={(taskId) => onSelectTask(taskId)}
              trigger={
                <Button type="button" size="sm" className="shrink-0">
                  <PlusIcon className="size-4" />
                  New Task
                </Button>
              }
            />
          </div>
        </div>

        <Dialog
          open={Boolean(taskPendingDelete)}
          onOpenChange={(open) => {
            if (!open && !deleteTaskMutation.isPending) {
              setTaskPendingDelete(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Task</DialogTitle>
              <DialogDescription>
                Delete &quot;{taskPendingDelete?.title ?? "this task"}&quot;
                permanently? This also removes its event history from Harbor.
              </DialogDescription>
            </DialogHeader>

            {taskActionError ? (
              <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700">
                {taskActionError}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTaskPendingDelete(null)}
                disabled={deleteTaskMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void handleDeleteTask()
                }}
                disabled={deleteTaskMutation.isPending}
              >
                <Trash2Icon className="size-4" />
                {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ScrollArea
          className="min-h-0 flex-1 overflow-hidden"
          viewportClassName="h-full min-h-0"
        >
          <div className="mr-3 min-w-0 space-y-2 pb-3">
            {listQuery.isLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full rounded-md" />
                ))
              : null}

            {!listQuery.isLoading && listQuery.isError ? (
              <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
                {getErrorMessage(listQuery.error)}
              </div>
            ) : null}

            {!listQuery.isLoading &&
            !listQuery.isError &&
            visibleTasks.length === 0 ? (
              <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                {emptyStateMessage}
              </div>
            ) : null}

            {taskActionError ? (
              <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
                {taskActionError}
              </div>
            ) : null}

            {!listQuery.isLoading && !listQuery.isError
              ? visibleTasks.map((task) => (
                  <TaskListItemCard
                    key={task.taskId}
                    task={task}
                    isActive={task.taskId === resolvedSelectedTaskId}
                    isArchived={selectedTab === "archived"}
                    archiveDisabled={archiveTaskMutation.isPending}
                    deleteDisabled={deleteTaskMutation.isPending}
                    onSelectTask={onSelectTask}
                    onArchiveTask={(taskId) => {
                      void handleArchiveTask(taskId)
                    }}
                    onDeleteTask={(nextTask) => {
                      setTaskActionError(null)
                      setTaskPendingDelete(nextTask)
                    }}
                  />
                ))
              : null}
          </div>
        </ScrollArea>
      </div>
    </section>
  )
}
