import { createFileRoute } from "@tanstack/react-router"

import { ProjectConsoleScreen } from "@/modules/projects"

export const Route = createFileRoute(
  "/workspaces/$workspaceId/projects/$projectId/",
)({
  component: WorkspaceProjectTaskRoutePage,
})

function WorkspaceProjectTaskRoutePage() {
  const { workspaceId, projectId } = Route.useParams()

  return <ProjectConsoleScreen projectId={projectId} workspaceId={workspaceId} />
}
