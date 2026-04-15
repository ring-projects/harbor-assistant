import { createFileRoute, Outlet } from "@tanstack/react-router"

import { ProjectSidebar } from "@/modules/projects"
import { RootNotFoundBoundary } from "@/routes/__root"

export const Route = createFileRoute("/_project-shell/$projectId")({
  component: ProjectLayoutRoute,
  notFoundComponent: RootNotFoundBoundary,
})

function ProjectLayoutRoute() {
  const { projectId } = Route.useParams()

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <ProjectSidebar projectId={projectId} />
      <div className="min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
