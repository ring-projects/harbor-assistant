import { createFileRoute } from "@tanstack/react-router"

import { OrchestrationScheduleScreen } from "@/modules/orchestrations"

export const Route = createFileRoute(
  "/workspaces/$workspaceId/projects/$projectId/schedule",
)({
  component: WorkspaceProjectScheduleRoutePage,
})

function WorkspaceProjectScheduleRoutePage() {
  const { workspaceId, projectId } = Route.useParams()

  return (
    <OrchestrationScheduleScreen
      workspaceId={workspaceId}
      projectId={projectId}
    />
  )
}
