import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"

import { ProjectHeader } from "@/modules/projects"
import { SettingsShell } from "@/modules/settings"
import { TaskWorkbench } from "@/modules/tasks/screens"
import { useAppStore } from "@/stores/app.store"

export const Route = createFileRoute(
  "/workspaces/$workspaceId/projects/$projectId/",
)({
  component: WorkspaceProjectTaskRoutePage,
})

function WorkspaceProjectTaskRoutePage() {
  const { workspaceId, projectId } = Route.useParams()
  const setActiveWorkspaceId = useAppStore((state) => state.setActiveWorkspaceId)
  const setActiveProjectId = useAppStore((state) => state.setActiveProjectId)

  useEffect(() => {
    setActiveWorkspaceId(workspaceId)
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
