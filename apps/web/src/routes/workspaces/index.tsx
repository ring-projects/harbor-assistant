import { createFileRoute } from "@tanstack/react-router"

import { WorkspaceSelectorPage } from "@/modules/workspaces"

export const Route = createFileRoute("/workspaces/")({
  component: WorkspacesIndexPage,
})

function WorkspacesIndexPage() {
  return <WorkspaceSelectorPage />
}
