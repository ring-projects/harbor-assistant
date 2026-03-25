import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  archiveProject,
  createProject,
  deleteProject,
  ProjectApiClientError,
  readProject,
  readProjects,
  readProjectSettings,
  restoreProject,
  updateProject,
  updateProjectSettings,
  type ArchiveProjectInput,
  type DeleteProjectInput,
  type UpdateProjectSettingsInput,
} from "@/modules/projects/api"
import type {
  Project,
  ProjectSettings,
} from "@/modules/projects/types"
import { useAppStore } from "@/stores/app.store"

export const PROJECTS_QUERY_KEY = ["projects"] as const

type ReadProjectsQueryOptions = {
  initialData?: Project[]
}

export const projectSettingsQueryKey = (projectId: string) =>
  [...PROJECTS_QUERY_KEY, "settings", projectId] as const

export const projectQueryKey = (projectId: string) =>
  [...PROJECTS_QUERY_KEY, "detail", projectId] as const

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
    queryFn: readProjects,
    initialData: options?.initialData,
  })
}

export function useProjectSettingsQuery(projectId: string | null) {
  return useQuery<ProjectSettings>({
    queryKey: projectSettingsQueryKey(projectId ?? "none"),
    queryFn: async () => {
      if (!projectId) {
        throw new ProjectApiClientError("Project ID is required.")
      }

      return readProjectSettings(projectId)
    },
    enabled: Boolean(projectId),
  })
}

export function useProjectQuery(projectId: string | null) {
  return useQuery<Project>({
    queryKey: projectQueryKey(projectId ?? "none"),
    queryFn: async () => {
      if (!projectId) {
        throw new ProjectApiClientError("Project ID is required.")
      }

      return readProject(projectId)
    },
    enabled: Boolean(projectId),
  })
}

function upsertProject(current: Project[] | undefined, project: Project) {
  if (!current?.length) {
    return [project]
  }

  const found = current.some((item) => item.id === project.id)
  if (!found) {
    return [project, ...current]
  }

  return current.map((item) => (item.id === project.id ? project : item))
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProject,
    onSuccess(project) {
      queryClient.setQueryData<Project[]>(PROJECTS_QUERY_KEY, (current) =>
        upsertProject(current, project),
      )
      queryClient.setQueryData(projectQueryKey(project.id), project)
      queryClient.setQueryData(projectSettingsQueryKey(project.id), project.settings)
    },
  })
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProject,
    onSuccess(project) {
      queryClient.setQueryData<Project[]>(PROJECTS_QUERY_KEY, (current) =>
        upsertProject(current, project),
      )
      queryClient.setQueryData(projectQueryKey(project.id), project)
      queryClient.setQueryData(projectSettingsQueryKey(project.id), project.settings)
    },
  })
}

export function useUpdateProjectSettingsMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<UpdateProjectSettingsInput, "projectId">) =>
      updateProjectSettings({
        projectId,
        ...input,
      }),
    onSuccess(project) {
      queryClient.setQueryData<Project[]>(PROJECTS_QUERY_KEY, (current) =>
        upsertProject(current, project),
      )
      queryClient.setQueryData(projectQueryKey(project.id), project)
      queryClient.setQueryData(projectSettingsQueryKey(projectId), project.settings)
    },
  })
}

function createProjectStatusMutation(
  mutationFn: (input: ArchiveProjectInput) => Promise<Project>,
) {
  return function useProjectStatusMutation() {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn,
      onSuccess(project) {
        queryClient.setQueryData<Project[]>(PROJECTS_QUERY_KEY, (current) =>
          upsertProject(current, project),
        )
        queryClient.setQueryData(projectQueryKey(project.id), project)
        queryClient.setQueryData(projectSettingsQueryKey(project.id), project.settings)
      },
    })
  }
}

export const useArchiveProjectMutation = createProjectStatusMutation(archiveProject)
export const useRestoreProjectMutation = createProjectStatusMutation(restoreProject)

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: DeleteProjectInput) => deleteProject(input),
    onSuccess(result) {
      const currentProjects =
        queryClient.getQueryData<Project[]>(PROJECTS_QUERY_KEY) ?? []
      const nextProjects = currentProjects.filter(
        (project) => project.id !== result.projectId,
      )

      queryClient.setQueryData<Project[]>(PROJECTS_QUERY_KEY, nextProjects)
      queryClient.removeQueries({
        queryKey: projectQueryKey(result.projectId),
      })
      queryClient.removeQueries({
        queryKey: projectSettingsQueryKey(result.projectId),
      })

      if (useAppStore.getState().activeProjectId === result.projectId) {
        useAppStore.getState().clearActiveProjectId()
      }
    },
  })
}

// Backward-compatible aliases for existing callers.
export const useProjectsQuery = useReadProjectsQuery
export const useAddProjectMutation = useCreateProjectMutation
