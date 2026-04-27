import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo } from "react"

import { useReadWorkspacesQuery } from "@/modules/workspaces/hooks"
import { WorkspaceSelectorPage } from "@/modules/workspaces"
import { useAppStore } from "@/stores/app.store"

export const Route = createFileRoute("/workspaces/")({
  component: WorkspacesIndexPage,
})

function WorkspacesIndexPage() {
  const navigate = useNavigate()
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId)
  const setActiveWorkspaceId = useAppStore(
    (state) => state.setActiveWorkspaceId,
  )
  const workspacesQuery = useReadWorkspacesQuery()

  const targetWorkspaceId = useMemo(() => {
    const workspaces = workspacesQuery.data ?? []
    if (!workspaces.length) {
      return null
    }

    const persistedWorkspace = workspaces.find(
      (workspace) => workspace.id === activeWorkspaceId,
    )
    if (persistedWorkspace) {
      return persistedWorkspace.id
    }

    const personalWorkspace = workspaces.find(
      (workspace) => workspace.type === "personal",
    )
    if (personalWorkspace) {
      return personalWorkspace.id
    }

    return workspaces[0]?.id ?? null
  }, [activeWorkspaceId, workspacesQuery.data])

  useEffect(() => {
    if (!targetWorkspaceId) {
      return
    }

    setActiveWorkspaceId(targetWorkspaceId)
    void navigate({
      to: "/workspaces/$workspaceId",
      params: { workspaceId: targetWorkspaceId },
      replace: true,
    })
  }, [navigate, setActiveWorkspaceId, targetWorkspaceId])

  if (workspacesQuery.isLoading || targetWorkspaceId) {
    return (
      <div className="bg-background text-foreground flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading console...</p>
      </div>
    )
  }

  return <WorkspaceSelectorPage />
}
