import { createFileRoute } from "@tanstack/react-router"

import { OrchestrationScheduleDetailScreen } from "@/modules/orchestrations"

export const Route = createFileRoute(
  "/workspaces/$workspaceId/projects/$projectId/schedule_/$orchestrationId",
)({
  component: WorkspaceProjectScheduleDetailRoutePage,
})

function WorkspaceProjectScheduleDetailRoutePage() {
  const { projectId, orchestrationId } = Route.useParams()

  return (
    <OrchestrationScheduleDetailScreen
      projectId={projectId}
      orchestrationId={orchestrationId}
    />
  )
}
