"use client"

import { useState } from "react"

import { TaskDiffPanel } from "./task-diff-panel"
import { TaskListPanel } from "./task-list-panel"
import { TaskTimelinePanel } from "./task-timeline-panel"

type TaskWorkbenchProps = {
  projectId: string
}

export function TaskWorkbench({ projectId }: TaskWorkbenchProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  return (
    <div className="h-full min-h-0 w-full max-w-full overflow-hidden">
      <div className="grid h-full min-h-0 w-full max-w-full grid-cols-1 divide-y bg-background xl:grid-cols-[360px_minmax(0,1fr)_minmax(0,1fr)] xl:divide-x xl:divide-y-0">
        <TaskListPanel
          projectId={projectId}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />

        <TaskTimelinePanel
          projectId={projectId}
          taskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />

        <TaskDiffPanel taskId={selectedTaskId} />
      </div>
    </div>
  )
}
