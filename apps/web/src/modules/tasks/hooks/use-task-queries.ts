"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { gitQueryKeys } from "@/modules/git"
import {
  breakTaskTurn,
  createTask,
  followupTask,
  readProjectTasks,
  readTaskDetail,
  readTaskEvents,
  retryTask,
  type CreateTaskInput,
} from "@/modules/tasks/api"
export { useTaskEventStream } from "./use-task-event-stream"
export { useProjectTaskListStream } from "./use-project-task-list-stream"

export const taskQueryKeys = {
  all: ["tasks"] as const,
  byProject(projectId: string) {
    return [...this.all, "project", projectId] as const
  },
  list(projectId: string) {
    return [...this.byProject(projectId), "list"] as const
  },
  detail(taskId: string) {
    return [...this.all, "detail", taskId] as const
  },
  events(taskId: string) {
    return [...this.all, "events", taskId] as const
  },
}

export function useTaskListQuery(args: {
  projectId: string
}) {
  return useQuery({
    queryKey: taskQueryKeys.list(args.projectId),
    queryFn: async () => {
      const result = await readProjectTasks({
        projectId: args.projectId,
      })

      return result.tasks
    },
    staleTime: 5_000,
  })
}

export function useTaskDetailQuery(taskId: string | null) {
  return useQuery({
    queryKey: taskQueryKeys.detail(taskId ?? "none"),
    queryFn: async () => {
      if (!taskId) {
        return null
      }

      return readTaskDetail(taskId)
    },
    enabled: Boolean(taskId),
  })
}

export function useTaskEventsQuery(args: {
  taskId: string | null
  enabled: boolean
}) {
  return useQuery({
    queryKey: taskQueryKeys.events(args.taskId ?? "none"),
    queryFn: async () => {
      if (!args.taskId) {
        return null
      }

      return readTaskEvents({
        taskId: args.taskId,
        limit: 500,
      })
    },
    enabled: args.enabled && Boolean(args.taskId),
  })
}

export function useCreateTaskMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(projectId, input),
    onSuccess(result) {
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.byProject(projectId),
      })
      void queryClient.invalidateQueries({
        queryKey: gitQueryKeys.byProject(projectId),
      })

      if (result.task) {
        queryClient.setQueryData(taskQueryKeys.detail(result.taskId), result.task)
      }
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.events(result.taskId),
      })
    },
  })
}

export function useBreakTaskTurnMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => breakTaskTurn(taskId),
    onSuccess(task) {
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.byProject(projectId),
      })
      void queryClient.invalidateQueries({
        queryKey: gitQueryKeys.byProject(projectId),
      })

      if (task) {
        queryClient.setQueryData(taskQueryKeys.detail(task.taskId), task)
        void queryClient.invalidateQueries({
          queryKey: taskQueryKeys.events(task.taskId),
        })
      }
    },
  })
}

export function useRetryTaskMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => retryTask(taskId),
    onSuccess(result) {
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.byProject(projectId),
      })
      void queryClient.invalidateQueries({
        queryKey: gitQueryKeys.byProject(projectId),
      })

      if (result.task) {
        queryClient.setQueryData(taskQueryKeys.detail(result.taskId), result.task)
      }
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.events(result.taskId),
      })
    },
  })
}

export function useTaskFollowupMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { taskId: string; prompt: string; model?: string }) =>
      followupTask(input.taskId, {
        prompt: input.prompt,
        model: input.model,
      }),
    onSuccess(result, variables) {
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.byProject(projectId),
      })
      void queryClient.invalidateQueries({
        queryKey: gitQueryKeys.byProject(projectId),
      })

      if (result.task) {
        queryClient.setQueryData(taskQueryKeys.detail(variables.taskId), result.task)
      }

      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(variables.taskId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.events(variables.taskId),
      })
    },
  })
}
