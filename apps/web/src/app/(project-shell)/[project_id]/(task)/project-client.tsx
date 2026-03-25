"use client"

import { useEffect } from "react"

import { ProjectHeader } from "@/modules/projects"
import { SettingsShell } from "@/modules/settings"
import { TaskWorkbench } from "@/modules/tasks/screens"
import { useAppStore } from "@/stores/app.store"

type ProjectClientProps = {
  projectId: string
}

export function ProjectClient({ projectId }: ProjectClientProps) {
  const setActiveProjectId = useAppStore((state) => state.setActiveProjectId)

  useEffect(() => {
    setActiveProjectId(projectId)
  }, [projectId, setActiveProjectId])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ProjectHeader />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <TaskWorkbench projectId={projectId} />
        <SettingsShell projectId={projectId} />
      </div>
    </div>
  )
}
