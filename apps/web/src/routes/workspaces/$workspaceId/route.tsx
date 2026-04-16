import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/workspaces/$workspaceId")({
  component: WorkspaceRouteLayout,
})

function WorkspaceRouteLayout() {
  return <Outlet />
}
