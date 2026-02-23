import { WorkspaceManager } from "@/components/workspace"
import {
  listWorkspaces,
  WorkspaceRepositoryError,
} from "@/services/workspace/workspace.repository"
import type { Workspace } from "@/services/workspace/types"

export default async function SettingsPage() {
  let workspaces: Workspace[] = []
  let initialError: string | null = null

  try {
    workspaces = await listWorkspaces()
  } catch (error) {
    if (error instanceof WorkspaceRepositoryError) {
      initialError = error.message
    } else {
      initialError = "Failed to load workspaces."
    }
  }

  return (
    <div className="bg-muted/30 flex flex-1 p-6">
      <div className="bg-card text-card-foreground mx-auto w-full max-w-4xl rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Workspace management
        </p>
        <div className="mt-6">
          <WorkspaceManager
            initialWorkspaces={workspaces}
            initialError={initialError}
          />
        </div>
      </div>
    </div>
  )
}
