import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router"

import { WorkspaceConsoleSidebar } from "@/modules/workspaces"

export const Route = createFileRoute("/workspaces/$workspaceId")({
  component: WorkspaceRouteLayout,
})

function WorkspaceRouteLayout() {
  const { workspaceId } = Route.useParams()
  const location = useLocation()
  const projectPathPrefix = `/workspaces/${encodeURIComponent(workspaceId)}/projects/`

  if (location.pathname.startsWith(projectPathPrefix)) {
    return <Outlet />
  }

  return (
    <div className="bg-sidebar text-foreground flex h-svh min-h-0 overflow-hidden">
      <WorkspaceConsoleSidebar workspaceId={workspaceId} />
      <div className="border-border/60 bg-surface-subtle min-w-0 flex-1 overflow-hidden border-l">
        <Outlet />
      </div>
    </div>
  )
}
