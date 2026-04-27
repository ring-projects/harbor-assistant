import { createFileRoute, Outlet } from "@tanstack/react-router"
import { useEffect } from "react"

import {
  ProjectConsoleSidebar,
  ProjectHeader,
} from "@/modules/projects/components"
import { SettingsShell } from "@/modules/settings"
import { useAppStore } from "@/stores/app.store"

export const Route = createFileRoute(
  "/workspaces/$workspaceId/projects/$projectId",
)({
  component: WorkspaceProjectLayoutRoute,
})

function WorkspaceProjectLayoutRoute() {
  const { workspaceId, projectId } = Route.useParams()
  const setActiveWorkspaceId = useAppStore(
    (state) => state.setActiveWorkspaceId,
  )
  const setActiveProjectId = useAppStore((state) => state.setActiveProjectId)

  useEffect(() => {
    setActiveWorkspaceId(workspaceId)
    setActiveProjectId(projectId)
  }, [projectId, setActiveProjectId, setActiveWorkspaceId, workspaceId])

  return (
    <div className="bg-background text-foreground flex h-svh min-h-0 overflow-hidden">
      <ProjectConsoleSidebar workspaceId={workspaceId} projectId={projectId} />

      <div className="border-border/60 bg-background min-w-0 flex-1 overflow-hidden border-l">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <ProjectHeader projectId={projectId} />

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <Outlet />
            <SettingsShell projectId={projectId} />
          </div>
        </div>
      </div>
    </div>
  )
}
