import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { readProject } from "@/modules/projects/api"
import { RootNotFoundBoundary } from "@/routes/__root"

export const Route = createFileRoute("/_project-shell/$projectId")({
  beforeLoad: async ({ params }) => {
    const project = await readProject(params.projectId)

    if (!project.workspaceId) {
      return
    }

    throw redirect({
      to: "/workspaces/$workspaceId/projects/$projectId",
      params: {
        workspaceId: project.workspaceId,
        projectId: project.id,
      },
      replace: true,
    })
  },
  component: LegacyProjectLayoutRoute,
  notFoundComponent: RootNotFoundBoundary,
})

function LegacyProjectLayoutRoute() {
  return <Outlet />
}
