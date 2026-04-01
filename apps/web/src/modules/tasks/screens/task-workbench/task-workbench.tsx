"use client"

import { useEffect, useState } from "react"

import { OrchestrationList } from "@/modules/orchestrations"
import { TaskList } from "@/modules/tasks/features/task-list"
import { TaskSessionPanel } from "@/modules/tasks/features/task-session"

type TaskWorkbenchProps = {
  projectId: string
}

export function TaskWorkbench({ projectId }: TaskWorkbenchProps) {
  const [selectedOrchestrationId, setSelectedOrchestrationId] =
    useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedTaskId(null)
  }, [selectedOrchestrationId])

  return (
    <div className="h-full min-h-0 w-full max-w-full overflow-hidden">
      <div className="bg-muted/30 grid h-full min-h-0 w-full max-w-full grid-cols-1 divide-y xl:grid-cols-[300px_360px_minmax(0,1fr)] xl:divide-x xl:divide-y-0">
        <OrchestrationList
          projectId={projectId}
          selectedOrchestrationId={selectedOrchestrationId}
          onSelectOrchestration={setSelectedOrchestrationId}
        />

        <TaskList
          projectId={projectId}
          orchestrationId={selectedOrchestrationId}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />

        <TaskSessionPanel projectId={projectId} taskId={selectedTaskId} />
      </div>
    </div>
  )
}
