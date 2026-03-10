"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  cancelTask,
  createTask,
  followupTask,
  readProjectTasks,
  readTaskDetail,
  readTaskTimeline,
  retryTask,
  type CreateTaskInput,
} from "@/modules/tasks/api"
import {
  TERMINAL_TASK_STATUSES,
} from "@/modules/tasks/contracts"

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
  timeline(taskId: string) {
    return [...this.all, "timeline", taskId] as const
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
    refetchInterval(query) {
      const tasks = query.state.data
      if (!tasks || tasks.length === 0) {
        return 5_000
      }

      const hasActiveTask = tasks.some(
        (task) => !TERMINAL_TASK_STATUSES.includes(task.status),
      )

      return hasActiveTask ? 2_500 : 6_000
    },
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
    refetchInterval: 3_000,
  })
}

export function useTaskTimelineQuery(args: {
  taskId: string | null
  enabled: boolean
}) {
  return useQuery({
    queryKey: taskQueryKeys.timeline(args.taskId ?? "none"),
    queryFn: async () => {
      if (!args.taskId) {
        return null
      }

      return readTaskTimeline({
        taskId: args.taskId,
        limit: 500,
      })
    },
    enabled: args.enabled && Boolean(args.taskId),
    refetchInterval: args.enabled ? 3_000 : false,
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

      if (result.task) {
        queryClient.setQueryData(taskQueryKeys.detail(result.taskId), result.task)
      }
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.timeline(result.taskId),
      })
    },
  })
}

export function useCancelTaskMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => cancelTask(taskId),
    onSuccess(task) {
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.byProject(projectId),
      })

      if (task) {
        queryClient.setQueryData(taskQueryKeys.detail(task.taskId), task)
        void queryClient.invalidateQueries({
          queryKey: taskQueryKeys.timeline(task.taskId),
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

      if (result.task) {
        queryClient.setQueryData(taskQueryKeys.detail(result.taskId), result.task)
      }
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.timeline(result.taskId),
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

      if (result.task) {
        queryClient.setQueryData(taskQueryKeys.detail(variables.taskId), result.task)
      }

      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(variables.taskId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.timeline(variables.taskId),
      })
    },
  })
}
