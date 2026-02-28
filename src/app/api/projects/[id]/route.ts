import {
  deleteProject,
  listProjects,
} from "@/services/project/project.repository"

import { mapProjectRouteError, projectJson } from "../utils"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const deleted = await deleteProject(id)
    const projects = await listProjects()

    if (!deleted) {
      return projectJson(
        {
          ok: false,
          projects,
          error: {
            code: "NOT_FOUND",
            message: `Project not found: ${id}`,
          },
        },
        404,
      )
    }

    return projectJson({
      ok: true,
      projects,
    })
  } catch (error) {
    const projects = await listProjects().catch(() => [])
    const mapped = mapProjectRouteError(error, "Failed to delete project.")
    return projectJson(
      {
        ok: false,
        projects,
        error: mapped.payload,
      },
      mapped.status,
    )
  }
}
