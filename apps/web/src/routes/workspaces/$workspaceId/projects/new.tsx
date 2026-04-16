import { createFileRoute } from "@tanstack/react-router"

import { LandingPage } from "@/modules/landing-page"

export const Route = createFileRoute("/workspaces/$workspaceId/projects/new")({
  component: WorkspaceNewProjectRoutePage,
})

function WorkspaceNewProjectRoutePage() {
  const { workspaceId } = Route.useParams()

  return <LandingPage workspaceId={workspaceId} />
}
