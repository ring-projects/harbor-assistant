"use client"

import { useEffect } from "react"

import { useAppStore } from "@/stores/app.store"
import { ProjectHeader } from "../components/project-header"
import { SettingsShell } from "@/modules/settings"
import { TaskWorkbench } from "@/modules/tasks/screens"

type ProjectConsoleScreenProps = {
  projectId: string
  workspaceId?: string | null
}

export function ProjectConsoleScreen({
  projectId,
  workspaceId = null,
}: ProjectConsoleScreenProps) {
  const setActiveWorkspaceId = useAppStore((state) => state.setActiveWorkspaceId)
  const setActiveProjectId = useAppStore((state) => state.setActiveProjectId)

  useEffect(() => {
    if (workspaceId) {
      setActiveWorkspaceId(workspaceId)
    }
    setActiveProjectId(projectId)
  }, [projectId, setActiveProjectId, setActiveWorkspaceId, workspaceId])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ProjectHeader projectId={projectId} />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <TaskWorkbench projectId={projectId} />
        <SettingsShell projectId={projectId} />
      </div>
    </div>
  )
}
