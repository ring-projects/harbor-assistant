"use server"

import { ERROR_CODES } from "@/constants"
import { requestServiceJson } from "@/lib/service-proxy"
import type { Project } from "@/services/project/types"

type ProjectActionError = {
  code: string
  message: string
}

export type ProjectActionResult = {
  ok: boolean
  projects: Project[]
  error?: ProjectActionError
}

type ProjectApiResponse = {
  ok: boolean
  projects?: Project[]
  error?: ProjectActionError
}

function toProjectActionResult(response: {
  status: number
  body: ProjectApiResponse | null
}): ProjectActionResult {
  if (response.body?.ok) {
    return {
      ok: true,
      projects: response.body.projects ?? [],
    }
  }

  return {
    ok: false,
    projects: response.body?.projects ?? [],
    error:
      response.body?.error ?? {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: `Unexpected error occurred while updating projects (status=${String(response.status)}).`,
      },
  }
}

export async function addProjectAction(input: {
  path: string
  name?: string
}): Promise<ProjectActionResult> {
  const response = await requestServiceJson<ProjectApiResponse>({
    path: "/v1/projects",
    method: "POST",
    payload: input,
  })

  return toProjectActionResult(response)
}

export async function listProjectsAction(): Promise<ProjectActionResult> {
  const response = await requestServiceJson<ProjectApiResponse>({
    path: "/v1/projects",
    method: "GET",
  })

  return toProjectActionResult(response)
}

export async function deleteProjectAction(input: {
  id: string
}): Promise<ProjectActionResult> {
  const response = await requestServiceJson<ProjectApiResponse>({
    path: `/v1/projects/${encodeURIComponent(input.id)}`,
    method: "DELETE",
  })

  return toProjectActionResult(response)
}
