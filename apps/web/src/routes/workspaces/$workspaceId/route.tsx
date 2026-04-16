import { createFileRoute, Outlet } from "@tanstack/react-router"

import { WorkspaceConsoleSidebar } from "@/modules/workspaces"

export const Route = createFileRoute("/workspaces/$workspaceId")({
  component: WorkspaceRouteLayout,
})

function WorkspaceRouteLayout() {
  const { workspaceId } = Route.useParams()

  return (
    <div className="bg-background flex h-svh min-h-0 overflow-hidden text-foreground">
      <WorkspaceConsoleSidebar workspaceId={workspaceId} />
      <div className="min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
