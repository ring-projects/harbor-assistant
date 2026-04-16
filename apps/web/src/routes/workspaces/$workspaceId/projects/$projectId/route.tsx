import { createFileRoute, Outlet } from "@tanstack/react-router"

import { ProjectSidebar } from "@/modules/projects"

export const Route = createFileRoute(
  "/workspaces/$workspaceId/projects/$projectId",
)({
  component: WorkspaceProjectLayoutRoute,
})

function WorkspaceProjectLayoutRoute() {
  const { workspaceId, projectId } = Route.useParams()

  return (
    <div className="bg-background flex h-svh min-h-0 overflow-hidden">
      <ProjectSidebar workspaceId={workspaceId} projectId={projectId} />
      <div className="min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
