"use server"

import {
  addWorkspace,
  deleteWorkspace,
  listWorkspaces,
  WorkspaceRepositoryError,
} from "@/services/workspace/workspace.repository"
import type { Workspace } from "@/services/workspace/types"

type WorkspaceActionError = {
  code: string
  message: string
}

export type WorkspaceActionResult = {
  ok: boolean
  workspaces: Workspace[]
  error?: WorkspaceActionError
}

function mapError(error: unknown): WorkspaceActionError {
  if (error instanceof WorkspaceRepositoryError) {
    return {
      code: error.code,
      message: error.message,
    }
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Unexpected error occurred while updating workspaces.",
  }
}

export async function addWorkspaceAction(input: {
  path: string
  name?: string
}): Promise<WorkspaceActionResult> {
  try {
    await addWorkspace(input)
    const workspaces = await listWorkspaces()
    return {
      ok: true,
      workspaces,
    }
  } catch (error) {
    const workspaces = await listWorkspaces().catch(() => [])
    return {
      ok: false,
      workspaces,
      error: mapError(error),
    }
  }
}

export async function deleteWorkspaceAction(input: {
  id: string
}): Promise<WorkspaceActionResult> {
  try {
    const deleted = await deleteWorkspace(input.id)
    if (!deleted) {
      const workspaces = await listWorkspaces()
      return {
        ok: false,
        workspaces,
        error: {
          code: "NOT_FOUND",
          message: `Workspace not found: ${input.id}`,
        },
      }
    }

    const workspaces = await listWorkspaces()
    return {
      ok: true,
      workspaces,
    }
  } catch (error) {
    const workspaces = await listWorkspaces().catch(() => [])
    return {
      ok: false,
      workspaces,
      error: mapError(error),
    }
  }
}
