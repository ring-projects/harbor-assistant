"use client"

import { useEffect, useMemo, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import {
  useArchiveTaskMutation,
  useDeleteTaskMutation,
  useOrchestrationTaskListQuery,
} from "@/modules/tasks/hooks/use-task-queries"
import {
  selectOrchestrationTasks,
  type TaskRecord,
  useTasksSessionStore,
} from "@/modules/tasks/store"
import { getErrorMessage } from "@/modules/tasks/view-models"
import {
  DeleteTaskDialog,
  type PendingTaskDelete,
} from "./delete-task-dialog"
import { TaskListHeader, type TaskListTab } from "./task-list-header"
import { TaskListItem } from "./task-list-item"

const EMPTY_ORCHESTRATION_TASKS: TaskRecord[] = []

type TaskListProps = {
  projectId: string
  orchestrationId: string | null
  selectedTaskId: string | null
  onSelectTask: (taskId: string | null) => void
}

export function TaskList({
  projectId,
  orchestrationId,
  selectedTaskId,
  onSelectTask,
}: TaskListProps) {
  const [taskPendingDelete, setTaskPendingDelete] =
    useState<PendingTaskDelete | null>(null)
  const archiveTaskMutation = useArchiveTaskMutation(projectId)
  const deleteTaskMutation = useDeleteTaskMutation(projectId)
  const listQuery = useOrchestrationTaskListQuery({ orchestrationId })
  const orchestrationTasks = useTasksSessionStore((state) =>
    orchestrationId
      ? selectOrchestrationTasks(state, orchestrationId)
      : EMPTY_ORCHESTRATION_TASKS,
  )
  const [selectedTab, setSelectedTab] = useState<TaskListTab>("all")

  const activeTasks = useMemo(
    () => orchestrationTasks.filter((task) => task.archivedAt === null),
    [orchestrationTasks],
  )
  const archivedTasks = useMemo(
    () => orchestrationTasks.filter((task) => task.archivedAt !== null),
    [orchestrationTasks],
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
      visibleTasks.some((task) => task.id === selectedTaskId)
    ) {
      return selectedTaskId
    }

    return visibleTasks[0]?.id ?? null
  }, [selectedTaskId, visibleTasks])

  const emptyStateMessage = useMemo(() => {
    if (!orchestrationId) {
      return "Select an orchestration to view its tasks."
    }

    if (orchestrationTasks.length === 0) {
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
  }, [orchestrationId, orchestrationTasks.length, selectedTab])

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
      await deleteTaskMutation.mutateAsync(taskPendingDelete.id)
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
          orchestrationId={orchestrationId}
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
              <div className="bg-surface-danger text-destructive rounded-md border border-destructive/25 p-3 text-xs">
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
                    key={task.id}
                    task={task}
                    isActive={task.id === resolvedSelectedTaskId}
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
