"use client"

import { useEffect, useMemo, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import {
  useArchiveTaskMutation,
  useDeleteTaskMutation,
  useProjectTaskListStream,
  useTaskListQuery,
} from "@/modules/tasks/hooks/use-task-queries"
import {
  selectProjectTasks,
  useTasksSessionStore,
} from "@/modules/tasks/store"
import { getErrorMessage } from "@/modules/tasks/view-models"
import {
  DeleteTaskDialog,
  type PendingTaskDelete,
} from "./delete-task-dialog"
import { TaskListHeader, type TaskListTab } from "./task-list-header"
import { TaskListItem } from "./task-list-item"

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
  const [taskPendingDelete, setTaskPendingDelete] =
    useState<PendingTaskDelete | null>(null)
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
        return activeTasks
      case "completed":
        return completedTasks
      case "archived":
        return archivedTasks
      case "running":
      default:
        return runningTasks
    }
  }, [activeTasks, archivedTasks, completedTasks, runningTasks, selectedTab])

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
        return "No active tasks yet."
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
      await archiveTaskMutation.mutateAsync(taskId)
    } catch (error) {
      console.log(error)
      // ignore
    }
  }

  async function handleDeleteTask() {
    if (!taskPendingDelete) {
      return
    }

    try {
      await deleteTaskMutation.mutateAsync(taskPendingDelete.taskId)
      setTaskPendingDelete(null)
    } catch (error) {
      console.log(error)
    }
  }

  return (
    <section className="min-h-0 bg-transparent p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <TaskListHeader
          projectId={projectId}
          selectedTab={selectedTab}
          onSelectTab={setSelectedTab}
          allCount={activeTasks.length}
          runningCount={runningTasks.length}
          completedCount={completedTasks.length}
          archivedCount={archivedTasks.length}
          onTaskCreated={(taskId) => onSelectTask(taskId)}
        />

        <DeleteTaskDialog
          pendingTaskDelete={taskPendingDelete}
          isDeleting={deleteTaskMutation.isPending}
          onOpenChange={(open) => {
            if (!open && !deleteTaskMutation.isPending) {
              setTaskPendingDelete(null)
            }
          }}
          onConfirm={() => {
            void handleDeleteTask()
          }}
        />

        <div className="native-thin-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-1">
          <div className="w-full max-w-full min-w-0 space-y-2 pb-3">
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

            {!listQuery.isLoading && !listQuery.isError
              ? visibleTasks.map((task) => (
                  <TaskListItem
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
                      setTaskPendingDelete(nextTask)
                    }}
                  />
                ))
              : null}
          </div>
        </div>
      </div>
    </section>
  )
}
