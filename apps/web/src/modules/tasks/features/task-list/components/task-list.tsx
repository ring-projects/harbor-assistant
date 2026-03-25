"use client"

import { Trash2Icon } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
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

export function TaskList({
  projectId,
  selectedTaskId,
  onSelectTask,
}: TaskListProps) {
  const [taskActionError, setTaskActionError] = useState<string | null>(null)
  const [taskPendingDelete, setTaskPendingDelete] = useState<
    | {
        taskId: string
        title: string
      }
    | null
  >(null)

  const archiveTaskMutation = useArchiveTaskMutation(projectId)
  const deleteTaskMutation = useDeleteTaskMutation(projectId)
  const listQuery = useTaskListQuery({
    projectId,
  })
  useProjectTaskListStream({
    projectId,
    enabled: true,
  })

  const allTasks = useTasksSessionStore((state) => selectProjectTasks(state, projectId))
  const [showArchivedTasks, setShowArchivedTasks] = useState(false)

  const activeTasks = useMemo(
    () => allTasks.filter((task) => task.archivedAt === null),
    [allTasks],
  )
  const archivedTasks = useMemo(
    () => allTasks.filter((task) => task.archivedAt !== null),
    [allTasks],
  )

  const resolvedSelectedTaskId = useMemo(() => {
    if (allTasks.length === 0) {
      return null
    }

    if (selectedTaskId && allTasks.some((task) => task.taskId === selectedTaskId)) {
      return selectedTaskId
    }

    return activeTasks[0]?.taskId ?? allTasks[0]?.taskId ?? null
  }, [activeTasks, allTasks, selectedTaskId])

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
    <section className="bg-background min-h-0 p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Task List</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowArchivedTasks((current) => !current)}
            >
              {showArchivedTasks ? "Hide Archived" : `Show Archived (${archivedTasks.length})`}
            </Button>
            <TaskCreateDialog
              projectId={projectId}
              onTaskCreated={(taskId) => onSelectTask(taskId)}
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
                Delete &quot;{taskPendingDelete?.title ?? "this task"}&quot; permanently?
                This also removes its event history from Harbor.
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

        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {listQuery.isLoading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-md" />
            ))
          ) : null}

          {!listQuery.isLoading && listQuery.isError ? (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
              {getErrorMessage(listQuery.error)}
            </div>
          ) : null}

          {!listQuery.isLoading && !listQuery.isError && activeTasks.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
              No tasks yet.
            </div>
          ) : null}

          {taskActionError ? (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
              {taskActionError}
            </div>
          ) : null}

          {!listQuery.isLoading && !listQuery.isError
            ? activeTasks.map((task) => (
                <TaskListItemCard
                  key={task.taskId}
                  task={task}
                  isActive={task.taskId === resolvedSelectedTaskId}
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

          {!listQuery.isLoading &&
          !listQuery.isError &&
          showArchivedTasks &&
          archivedTasks.length > 0 ? (
            <div className="space-y-2 pt-3">
              <div className="text-muted-foreground px-1 text-[11px] font-medium uppercase tracking-wide">
                Archived
              </div>
              {archivedTasks.map((task) => (
                <TaskListItemCard
                  key={task.taskId}
                  task={task}
                  isActive={task.taskId === resolvedSelectedTaskId}
                  isArchived
                  deleteDisabled={deleteTaskMutation.isPending}
                  onSelectTask={onSelectTask}
                  onDeleteTask={(nextTask) => {
                    setTaskActionError(null)
                    setTaskPendingDelete(nextTask)
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
