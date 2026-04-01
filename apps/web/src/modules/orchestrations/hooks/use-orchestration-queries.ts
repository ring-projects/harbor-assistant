"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  bootstrapOrchestration,
  createOrchestration,
  readOrchestration,
  readProjectOrchestrations,
  type BootstrapOrchestrationInput,
  type CreateOrchestrationInput,
} from "@/modules/orchestrations/api"
import type {
  OrchestrationDetail,
  OrchestrationListItem,
} from "@/modules/orchestrations/contracts"
import { gitQueryKeys } from "@/modules/git"
import type { TaskDetail, TaskListItem } from "@/modules/tasks/contracts"
import { taskQueryKeys } from "@/modules/tasks/hooks"
import { useTasksSessionStore } from "@/modules/tasks/store"

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

function upsertTask(
  current: TaskListItem[] | undefined,
  task: TaskDetail,
) {
  if (!current?.length) {
    return [task]
  }

  const found = current.some((item) => item.id === task.id)

  if (!found) {
    return [task, ...current]
  }

  return current.map((item) => (item.id === task.id ? task : item))
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

export function useBootstrapOrchestrationMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<BootstrapOrchestrationInput, "projectId">) =>
      bootstrapOrchestration({
        projectId,
        ...input,
      }),
    onSuccess(result) {
      void queryClient.invalidateQueries({
        queryKey: gitQueryKeys.byProject(projectId),
      })

      queryClient.setQueryData<OrchestrationListItem[]>(
        orchestrationQueryKeys.list(projectId),
        (current) => upsertOrchestration(current, result.orchestration),
      )
      queryClient.setQueryData(
        orchestrationQueryKeys.detail(result.orchestration.id),
        result.orchestration,
      )
      queryClient.setQueryData<TaskListItem[]>(
        taskQueryKeys.listByOrchestration(result.orchestration.id),
        (current) => upsertTask(current, result.task),
      )
      queryClient.setQueryData(taskQueryKeys.detail(result.task.id), result.task)
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.events(result.task.id),
      })

      useTasksSessionStore.getState().applyTaskUpsert(result.task)
    },
  })
}
