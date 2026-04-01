"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createOrchestration,
  readOrchestration,
  readProjectOrchestrations,
  type CreateOrchestrationInput,
} from "@/modules/orchestrations/api"
import type {
  OrchestrationDetail,
  OrchestrationListItem,
} from "@/modules/orchestrations/contracts"

export const orchestrationQueryKeys = {
  all: ["orchestrations"] as const,
  byProject(projectId: string) {
    return [...this.all, "project", projectId] as const
  },
  list(projectId: string) {
    return [...this.byProject(projectId), "list"] as const
  },
  detail(orchestrationId: string) {
    return [...this.all, "detail", orchestrationId] as const
  },
}

export function useProjectOrchestrationsQuery(projectId: string) {
  return useQuery<OrchestrationListItem[]>({
    queryKey: orchestrationQueryKeys.list(projectId),
    queryFn: () => readProjectOrchestrations(projectId),
    staleTime: 5_000,
  })
}

export function useOrchestrationDetailQuery(orchestrationId: string | null) {
  return useQuery<OrchestrationDetail>({
    queryKey: orchestrationQueryKeys.detail(orchestrationId ?? "none"),
    queryFn: async () => {
      if (!orchestrationId) {
        throw new Error("Orchestration ID is required.")
      }

      return readOrchestration(orchestrationId)
    },
    enabled: Boolean(orchestrationId),
  })
}

function upsertOrchestration(
  current: OrchestrationListItem[] | undefined,
  orchestration: OrchestrationDetail,
) {
  if (!current?.length) {
    return [orchestration]
  }

  const found = current.some(
    (item) => item.id === orchestration.id,
  )

  if (!found) {
    return [orchestration, ...current]
  }

  return current.map((item) => (item.id === orchestration.id ? orchestration : item))
}

export function useCreateOrchestrationMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<CreateOrchestrationInput, "projectId">) =>
      createOrchestration({
        projectId,
        ...input,
      }),
    onSuccess(orchestration) {
      queryClient.setQueryData<OrchestrationListItem[]>(
        orchestrationQueryKeys.list(projectId),
        (current) => upsertOrchestration(current, orchestration),
      )
      queryClient.setQueryData(
        orchestrationQueryKeys.detail(orchestration.id),
        orchestration,
      )
    },
  })
}
