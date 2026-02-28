import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { ProjectApiResult } from "@/services/project/contracts"
import type { Project } from "@/services/project/types"

const PROJECTS_QUERY_KEY = ["projects"] as const

type ProjectMutationInput = {
  path: string
  name?: string
}

class ProjectApiClientError extends Error {
  code: string
  status: number

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message)
    this.name = "ProjectApiClientError"
    this.code = options?.code ?? "INTERNAL_ERROR"
    this.status = options?.status ?? 500
  }
}

async function parseProjectApiResponse(response: Response) {
  const payload = (await response
    .json()
    .catch(() => null)) as ProjectApiResult | null

  if (!payload) {
    throw new ProjectApiClientError("Server returned invalid JSON response.", {
      status: response.status,
    })
  }

  if (!response.ok || !payload.ok) {
    throw new ProjectApiClientError(
      payload.error?.message ?? "Project request failed.",
      {
        code: payload.error?.code,
        status: response.status,
      },
    )
  }

  return payload
}

async function fetchProjects() {
  const response = await fetch("/api/projects", {
    method: "GET",
    cache: "no-store",
  })
  const payload = await parseProjectApiResponse(response)
  return payload.projects
}

async function createProject(input: ProjectMutationInput) {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })
  const payload = await parseProjectApiResponse(response)
  return payload.projects
}

async function removeProject(projectId: string) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}`,
    {
      method: "DELETE",
    },
  )
  const payload = await parseProjectApiResponse(response)
  return payload.projects
}

export function getProjectActionError(error: unknown) {
  if (error instanceof ProjectApiClientError) {
    return `${error.code}: ${error.message}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Unknown project error."
}

export function useProjectsQuery() {
  return useQuery<Project[]>({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: fetchProjects,
  })
}

export function useAddProjectMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProject,
    onSuccess(projects) {
      queryClient.setQueryData(PROJECTS_QUERY_KEY, projects)
    },
  })
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: removeProject,
    onSuccess(projects) {
      queryClient.setQueryData(PROJECTS_QUERY_KEY, projects)
    },
  })
}
