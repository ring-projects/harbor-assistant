import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  archiveProject,
  bindProjectRepository,
  createProject,
  deleteProject,
  ProjectApiClientError,
  provisionProjectWorkspace,
  readProject,
  readProjectRepositoryBinding,
  readProjects,
  readProjectSettings,
  readGitHubAppInstallUrl,
  readGitHubInstallationRepositories,
  readGitHubInstallations,
  restoreProject,
  syncProjectWorkspace,
  updateProject,
  updateProjectSettings,
  type ArchiveProjectInput,
  type BindProjectRepositoryInput,
  type DeleteProjectInput,
  type ProvisionProjectWorkspaceResult,
  type SyncProjectWorkspaceResult,
  type UpdateProjectSettingsInput,
} from "@/modules/projects/api"
import type {
  GitHubInstallation,
  GitHubRepository,
  Project,
  ProjectRepositoryBinding,
  ProjectSettings,
} from "@/modules/projects/types"
import { useAppStore } from "@/stores/app.store"

export const PROJECTS_QUERY_KEY = ["projects"] as const
export const GITHUB_INTEGRATION_QUERY_KEY = ["github-integration"] as const

type ReadProjectsQueryOptions = {
  initialData?: Project[]
  enabled?: boolean
}

export const projectSettingsQueryKey = (projectId: string) =>
  [...PROJECTS_QUERY_KEY, "settings", projectId] as const

export const projectQueryKey = (projectId: string) =>
  [...PROJECTS_QUERY_KEY, "detail", projectId] as const

export const projectRepositoryBindingQueryKey = (projectId: string) =>
  [...PROJECTS_QUERY_KEY, "repository-binding", projectId] as const

export const githubInstallUrlQueryKey = (returnTo: string | null) =>
  [...GITHUB_INTEGRATION_QUERY_KEY, "install-url", returnTo ?? "none"] as const

export const githubInstallationsQueryKey = () =>
  [...GITHUB_INTEGRATION_QUERY_KEY, "installations"] as const

export const githubInstallationRepositoriesQueryKey = (
  installationId: string,
) =>
  [
    ...GITHUB_INTEGRATION_QUERY_KEY,
    "installations",
    installationId,
    "repositories",
  ] as const

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
    enabled: options?.enabled,
  })
}

export function useGitHubInstallUrlQuery(
  returnTo: string | null,
  enabled = true,
) {
  return useQuery<string>({
    queryKey: githubInstallUrlQueryKey(returnTo),
    queryFn: () => readGitHubAppInstallUrl(returnTo),
    enabled,
  })
}

export function useGitHubInstallationsQuery(enabled = true) {
  return useQuery<GitHubInstallation[]>({
    queryKey: githubInstallationsQueryKey(),
    queryFn: readGitHubInstallations,
    enabled,
  })
}

export function useGitHubInstallationRepositoriesQuery(
  installationId: string | null,
) {
  return useQuery<GitHubRepository[]>({
    queryKey: githubInstallationRepositoriesQueryKey(installationId ?? "none"),
    queryFn: async () => {
      if (!installationId) {
        throw new ProjectApiClientError("Installation ID is required.")
      }

      return readGitHubInstallationRepositories(installationId)
    },
    enabled: Boolean(installationId),
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

export function useProjectRepositoryBindingQuery(
  projectId: string | null,
  enabled = true,
) {
  return useQuery<ProjectRepositoryBinding>({
    queryKey: projectRepositoryBindingQueryKey(projectId ?? "none"),
    queryFn: async () => {
      if (!projectId) {
        throw new ProjectApiClientError("Project ID is required.")
      }

      return readProjectRepositoryBinding(projectId)
    },
    enabled: enabled && Boolean(projectId),
    retry: false,
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
      queryClient.setQueryData(
        projectSettingsQueryKey(project.id),
        project.settings,
      )
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
      queryClient.setQueryData(
        projectSettingsQueryKey(project.id),
        project.settings,
      )
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
      queryClient.setQueryData(
        projectSettingsQueryKey(projectId),
        project.settings,
      )
    },
  })
}

function updateProvisionedProjectState(
  queryClient: ReturnType<typeof useQueryClient>,
  result: ProvisionProjectWorkspaceResult,
) {
  queryClient.setQueryData<Project[]>(PROJECTS_QUERY_KEY, (current) =>
    upsertProject(current, result.project),
  )
  queryClient.setQueryData(projectQueryKey(result.project.id), result.project)
  queryClient.setQueryData(
    projectSettingsQueryKey(result.project.id),
    result.project.settings,
  )
  queryClient.setQueryData(
    projectRepositoryBindingQueryKey(result.project.id),
    result.repositoryBinding,
  )
}

export function useProvisionProjectWorkspaceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId }: { projectId: string }) =>
      provisionProjectWorkspace(projectId),
    onSuccess(result) {
      updateProvisionedProjectState(queryClient, result)
    },
  })
}

export function useBindProjectRepositoryMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<BindProjectRepositoryInput, "projectId">) =>
      bindProjectRepository({
        projectId,
        ...input,
      }),
    onSuccess(repositoryBinding) {
      queryClient.setQueryData(
        projectRepositoryBindingQueryKey(projectId),
        repositoryBinding,
      )
      queryClient.invalidateQueries({
        queryKey: projectQueryKey(projectId),
      })
    },
  })
}

export function useSyncProjectWorkspaceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId }: { projectId: string }) =>
      syncProjectWorkspace(projectId),
    onSuccess(result: SyncProjectWorkspaceResult) {
      queryClient.invalidateQueries({
        queryKey: projectRepositoryBindingQueryKey(result.projectId),
      })
      queryClient.invalidateQueries({
        queryKey: projectQueryKey(result.projectId),
      })
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
        queryClient.setQueryData(
          projectSettingsQueryKey(project.id),
          project.settings,
        )
      },
    })
  }
}

export const useArchiveProjectMutation =
  createProjectStatusMutation(archiveProject)
export const useRestoreProjectMutation =
  createProjectStatusMutation(restoreProject)

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
