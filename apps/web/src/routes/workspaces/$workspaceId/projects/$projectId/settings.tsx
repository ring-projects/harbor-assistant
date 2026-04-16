import { createFileRoute } from "@tanstack/react-router"

import { ProjectSettingsView } from "@/modules/settings"

export const Route = createFileRoute(
  "/workspaces/$workspaceId/projects/$projectId/settings",
)({
  component: WorkspaceProjectSettingsRoutePage,
})

function WorkspaceProjectSettingsRoutePage() {
  const { projectId } = Route.useParams()

  return (
    <div className="h-full overflow-auto">
      <ProjectSettingsView projectId={projectId} />
    </div>
  )
}
