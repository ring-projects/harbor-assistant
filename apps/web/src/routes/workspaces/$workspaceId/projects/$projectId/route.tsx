import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/workspaces/$workspaceId/projects/$projectId",
)({
  component: WorkspaceProjectLayoutRoute,
})

function WorkspaceProjectLayoutRoute() {
  return <Outlet />
}
