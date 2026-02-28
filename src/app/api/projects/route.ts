import { z } from "zod"

import { addProject, listProjects } from "@/services/project/project.repository"

import { mapProjectRouteError, projectJson } from "./utils"

export const runtime = "nodejs"

const AddProjectInputSchema = z.object({
  path: z.string(),
  name: z.string().optional(),
})

export async function GET() {
  try {
    const projects = await listProjects()
    return projectJson({
      ok: true,
      projects,
    })
  } catch (error) {
    const mapped = mapProjectRouteError(error, "Failed to fetch projects.")
    return projectJson(
      {
        ok: false,
        projects: [],
        error: mapped.payload,
      },
      mapped.status,
    )
  }
}

export async function POST(request: Request) {
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

  const parsed = AddProjectInputSchema.safeParse(requestBody)
  if (!parsed.success) {
    return projectJson(
      {
        ok: false,
        projects: [],
        error: {
          code: "INVALID_REQUEST_BODY",
          message: "Expected payload: { path: string; name?: string }.",
        },
      },
      400,
    )
  }

  try {
    await addProject(parsed.data)
    const projects = await listProjects()
    return projectJson({
      ok: true,
      projects,
    })
  } catch (error) {
    const projects = await listProjects().catch(() => [])
    const mapped = mapProjectRouteError(error, "Failed to add project.")
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
