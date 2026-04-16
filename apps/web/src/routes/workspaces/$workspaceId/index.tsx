import { createFileRoute } from "@tanstack/react-router"

import { WorkspaceHomePage } from "@/modules/workspaces"

export const Route = createFileRoute("/workspaces/$workspaceId/")({
  component: WorkspaceHomeRoutePage,
})

function WorkspaceHomeRoutePage() {
  const { workspaceId } = Route.useParams()

  return <WorkspaceHomePage workspaceId={workspaceId} />
}
