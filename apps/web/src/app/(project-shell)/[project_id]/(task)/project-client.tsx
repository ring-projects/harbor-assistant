"use client"

import { useEffect } from "react"

import type { Project } from "@/modules/projects/types"
import { SettingsShell } from "@/modules/settings"
import { TaskWorkbench } from "@/modules/tasks"
import { useAppStore } from "@/stores/app.store"
import { ProjectHeader } from "./project-header"

type ProjectClientProps = {
  projectId: string
  initialProjects?: Project[]
}

export function ProjectClient({
  projectId,
  initialProjects,
}: ProjectClientProps) {
  const setActiveProjectId = useAppStore((state) => state.setActiveProjectId)

  useEffect(() => {
    setActiveProjectId(projectId)
  }, [projectId, setActiveProjectId])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ProjectHeader
        projectId={projectId}
        initialProjects={initialProjects}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <TaskWorkbench projectId={projectId} />
        <SettingsShell projectId={projectId} />
      </div>
    </div>
  )
}
