import { createFileRoute } from "@tanstack/react-router"

import { ProjectSettingsView } from "@/modules/settings"

export const Route = createFileRoute("/_project-shell/$projectId/settings")({
  component: ProjectSettingsPage,
})

function ProjectSettingsPage() {
  const { projectId } = Route.useParams()

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ProjectSettingsView projectId={projectId} />
    </div>
  )
}
