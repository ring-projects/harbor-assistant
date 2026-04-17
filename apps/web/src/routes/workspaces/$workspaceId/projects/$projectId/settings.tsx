import { createFileRoute } from "@tanstack/react-router"

import { ProjectSettingsScreen } from "@/modules/projects"

export const Route = createFileRoute(
  "/workspaces/$workspaceId/projects/$projectId/settings",
)({
  component: WorkspaceProjectSettingsRoutePage,
})

function WorkspaceProjectSettingsRoutePage() {
  const { projectId } = Route.useParams()

  return <ProjectSettingsScreen projectId={projectId} />
}
