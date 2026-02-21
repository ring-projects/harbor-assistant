import { NextResponse } from "next/server"

import {
  addWorkspace,
  listWorkspaces,
  WorkspaceRepositoryError,
} from "@/services/workspace/workspace.repository"

export const runtime = "nodejs"

function toStatusCode(code: WorkspaceRepositoryError["code"]) {
  if (
    code === "INVALID_PATH" ||
    code === "INVALID_WORKSPACE_ID" ||
    code === "NOT_A_DIRECTORY"
  ) {
    return 400
  }

  if (code === "PATH_NOT_FOUND") {
    return 404
  }

  if (code === "DUPLICATE_PATH") {
    return 409
  }

  return 500
}

export async function GET() {
  try {
    const workspaces = await listWorkspaces()
    return NextResponse.json({
      ok: true,
      data: workspaces,
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
          message: "Unexpected error occurred while listing workspaces.",
        },
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 }
    )
  }

  const inputPath =
    typeof payload === "object" &&
    payload !== null &&
    "path" in payload &&
    typeof payload.path === "string"
      ? payload.path
      : ""

  const inputName =
    typeof payload === "object" &&
    payload !== null &&
    "name" in payload &&
    typeof payload.name === "string"
      ? payload.name
      : undefined

  try {
    const workspace = await addWorkspace({
      path: inputPath,
      name: inputName,
    })

    return NextResponse.json(
      {
        ok: true,
        data: workspace,
      },
      { status: 201 }
    )
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
          message: "Unexpected error occurred while creating workspace.",
        },
      },
      { status: 500 }
    )
  }
}
