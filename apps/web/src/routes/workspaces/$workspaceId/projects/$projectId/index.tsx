import { createFileRoute } from "@tanstack/react-router"

import { TaskWorkbench } from "@/modules/tasks/screens"

export const Route = createFileRoute(
  "/workspaces/$workspaceId/projects/$projectId/",
)({
  component: WorkspaceProjectTaskRoutePage,
})

function WorkspaceProjectTaskRoutePage() {
  const { projectId } = Route.useParams()

  return <TaskWorkbench projectId={projectId} />
}
