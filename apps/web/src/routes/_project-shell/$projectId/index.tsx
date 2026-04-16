import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"

import { ProjectHeader } from "@/modules/projects"
import { SettingsShell } from "@/modules/settings"
import { TaskWorkbench } from "@/modules/tasks/screens"
import { useAppStore } from "@/stores/app.store"

export const Route = createFileRoute("/_project-shell/$projectId/")({
  component: ProjectTaskRoutePage,
})

function ProjectTaskRoutePage() {
  const { projectId } = Route.useParams()
  const setActiveProjectId = useAppStore((state) => state.setActiveProjectId)

  useEffect(() => {
    setActiveProjectId(projectId)
  }, [projectId, setActiveProjectId])

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
