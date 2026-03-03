import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { API_ROUTES, ERROR_CODES, getProjectByIdApiRoute } from "@/constants"
import type { ProjectApiResult } from "@/services/project/contracts"
import type { Project } from "@/services/project/types"

export const PROJECTS_QUERY_KEY = ["projects"] as const

type ReadProjectsQueryOptions = {
  initialData?: Project[]
}

type CreateProjectInput = {
  path: string
  name?: string
}

type UpdateProjectInput = {
  id: string
  path?: string
  name?: string
}

class ProjectApiClientError extends Error {
  code: string
  status: number

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message)
    this.name = "ProjectApiClientError"
    this.code = options?.code ?? ERROR_CODES.INTERNAL_ERROR
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
  const response = await fetch(API_ROUTES.projects, {
    method: "GET",
    cache: "no-store",
  })
  const payload = await parseProjectApiResponse(response)
  return payload.projects
}

async function createProject(input: CreateProjectInput) {
  const response = await fetch(API_ROUTES.projects, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })
  const payload = await parseProjectApiResponse(response)
  return payload.projects
}

async function updateProject(input: UpdateProjectInput) {
  const response = await fetch(getProjectByIdApiRoute(input.id), {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      path: input.path,
      name: input.name,
    }),
  })
  const payload = await parseProjectApiResponse(response)
  return payload.projects
}

async function deleteProject(projectId: string) {
  const response = await fetch(getProjectByIdApiRoute(projectId), {
    method: "DELETE",
  })
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

export function useReadProjectsQuery(options?: ReadProjectsQueryOptions) {
  return useQuery<Project[]>({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: fetchProjects,
    initialData: options?.initialData,
  })
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProject,
    onSuccess(projects) {
      queryClient.setQueryData(PROJECTS_QUERY_KEY, projects)
    },
  })
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProject,
    onSuccess(projects) {
      queryClient.setQueryData(PROJECTS_QUERY_KEY, projects)
    },
  })
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProject,
    onSuccess(projects) {
      queryClient.setQueryData(PROJECTS_QUERY_KEY, projects)
    },
  })
}

// Backward-compatible aliases for existing callers.
export const useProjectsQuery = useReadProjectsQuery
export const useAddProjectMutation = useCreateProjectMutation
