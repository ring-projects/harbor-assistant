import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createWorkspace,
  readWorkspaceInvitations,
  readWorkspaces,
  WorkspaceApiClientError,
  type CreateWorkspaceInput,
} from "@/modules/workspaces/api/workspace-api-client"
import type { Workspace, WorkspaceInvitation } from "@/modules/workspaces/types"

export const WORKSPACES_QUERY_KEY = ["workspaces"] as const

export const workspaceInvitationsQueryKey = (workspaceId: string) =>
  [...WORKSPACES_QUERY_KEY, "invitations", workspaceId] as const

export function getWorkspaceActionError(error: unknown) {
  if (error instanceof WorkspaceApiClientError) {
    return `${error.code}: ${error.message}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Unknown workspace error."
}

export function useReadWorkspacesQuery(enabled = true) {
  return useQuery<Workspace[]>({
    queryKey: WORKSPACES_QUERY_KEY,
    queryFn: readWorkspaces,
    enabled,
  })
}

export function useWorkspaceQuery(workspaceId: string | null) {
  const workspacesQuery = useReadWorkspacesQuery(Boolean(workspaceId))

  return {
    ...workspacesQuery,
    data:
      workspacesQuery.data?.find((workspace) => workspace.id === workspaceId) ??
      null,
  }
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) => createWorkspace(input),
    onSuccess(workspace) {
      queryClient.setQueryData<Workspace[]>(WORKSPACES_QUERY_KEY, (current) =>
        current?.length ? [workspace, ...current] : [workspace],
      )
    },
  })
}

export function useWorkspaceInvitationsQuery(workspaceId: string | null) {
  return useQuery<WorkspaceInvitation[]>({
    queryKey: workspaceInvitationsQueryKey(workspaceId ?? "none"),
    queryFn: async () => {
      if (!workspaceId) {
        throw new WorkspaceApiClientError("Workspace ID is required.")
      }

      return readWorkspaceInvitations(workspaceId)
    },
    enabled: Boolean(workspaceId),
  })
}
