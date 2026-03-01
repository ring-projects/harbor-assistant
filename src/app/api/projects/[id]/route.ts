import {
  deleteProject,
  listProjects,
  updateProject,
} from "@/services/project/project.repository"
import { z } from "zod"

import { mapProjectRouteError, projectJson } from "../utils"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const UpdateProjectInputSchema = z
  .object({
    path: z.string().optional(),
    name: z.string().optional(),
  })
  .refine(
    (value) => typeof value.path === "string" || typeof value.name === "string",
    {
      message: "At least one field (path or name) must be provided.",
    },
  )

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return projectJson(
      {
        ok: false,
        projects: [],
        error: {
          code: "INVALID_REQUEST_BODY",
          message: "Request body must be valid JSON.",
        },
      },
      400,
    )
  }

  const parsed = UpdateProjectInputSchema.safeParse(requestBody)
  if (!parsed.success) {
    return projectJson(
      {
        ok: false,
        projects: [],
        error: {
          code: "INVALID_REQUEST_BODY",
          message: "Expected payload: { path?: string; name?: string }.",
        },
      },
      400,
    )
  }

  try {
    const updated = await updateProject({
      id,
      ...parsed.data,
    })
    const projects = await listProjects()

    if (!updated) {
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
    const mapped = mapProjectRouteError(error, "Failed to update project.")
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
