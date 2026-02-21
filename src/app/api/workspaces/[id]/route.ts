import { NextResponse } from "next/server"

import {
  deleteWorkspace,
  WorkspaceRepositoryError,
} from "@/services/workspace/workspace.repository"

export const runtime = "nodejs"

function toStatusCode(code: WorkspaceRepositoryError["code"]) {
  if (code === "INVALID_WORKSPACE_ID") {
    return 400
  }

  return 500
}

export async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  try {
    const deleted = await deleteWorkspace(id)
    if (!deleted) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: `Workspace not found: ${id}`,
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    if (error instanceof WorkspaceRepositoryError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: toStatusCode(error.code) }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected error occurred while deleting workspace.",
        },
      },
      { status: 500 }
    )
  }
}
