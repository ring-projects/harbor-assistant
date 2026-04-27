"use client"

import { useMemo, useState } from "react"

import { OrchestrationList } from "@/modules/orchestrations"
import { useOrchestrationTaskListQuery } from "@/modules/tasks/hooks/use-task-queries"
import { TaskSessionPanel } from "@/modules/tasks/features/task-session"

type TaskWorkbenchProps = {
  projectId: string
}

export function TaskWorkbench({ projectId }: TaskWorkbenchProps) {
  const [selectedOrchestrationId, setSelectedOrchestrationId] = useState<
    string | null
  >(null)
  const taskListQuery = useOrchestrationTaskListQuery({
    orchestrationId: selectedOrchestrationId,
  })
  const selectedTaskId = useMemo(() => {
    const tasks = taskListQuery.data ?? []
    if (tasks.length === 0) {
      return null
    }

    const activeTasks = tasks.filter((task) => task.archivedAt === null)
    const candidates = activeTasks.length > 0 ? activeTasks : tasks

    return (
      [...candidates].sort((left, right) => {
        const leftTimestamp =
          Date.parse(left.finishedAt ?? left.startedAt ?? left.createdAt) || 0
        const rightTimestamp =
          Date.parse(right.finishedAt ?? right.startedAt ?? right.createdAt) ||
          0

        return rightTimestamp - leftTimestamp
      })[0]?.id ?? null
    )
  }, [taskListQuery.data])
  const emptyStateMessage = selectedOrchestrationId
    ? "This session does not have runs yet."
    : "Select a session to view activity."

  return (
    <div className="h-full min-h-0 w-full max-w-full overflow-hidden">
      <div className="bg-background divide-border/60 grid h-full min-h-0 w-full max-w-full grid-cols-1 divide-y xl:auto-rows-[minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] xl:divide-x xl:divide-y-0">
        <OrchestrationList
          projectId={projectId}
          selectedOrchestrationId={selectedOrchestrationId}
          onSelectOrchestration={setSelectedOrchestrationId}
        />

        <TaskSessionPanel
          projectId={projectId}
          orchestrationId={selectedOrchestrationId}
          taskId={selectedTaskId}
          emptyStateMessage={emptyStateMessage}
        />
      </div>
    </div>
  )
}
