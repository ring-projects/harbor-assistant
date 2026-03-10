"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  cancelTask,
  createTask,
  followupTask,
  readProjectTasks,
  readTaskConversation,
  readTaskDetail,
  readTaskEvents,
  retryTask,
  type CreateTaskInput,
} from "@/modules/tasks/lib/task-api-client"
import {
  TERMINAL_TASK_STATUSES,
  type TaskFilter,
  type TaskListItem,
} from "@/modules/tasks/types/task-contract"

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
  conversation(taskId: string) {
    return [...this.all, "conversation", taskId] as const
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

export function useTaskEventsQuery(args: {
  taskId: string | null
  enabled: boolean
}) {
  return useQuery({
    queryKey: taskQueryKeys.events(args.taskId ?? "none"),
    queryFn: async () => {
      if (!args.taskId) {
        return []
      }

      return readTaskEvents({
        taskId: args.taskId,
      })
    },
    enabled: args.enabled && Boolean(args.taskId),
    refetchInterval: args.enabled ? 3_000 : false,
  })
}

export function useTaskConversationQuery(args: {
  taskId: string | null
  enabled: boolean
}) {
  return useQuery({
    queryKey: taskQueryKeys.conversation(args.taskId ?? "none"),
    queryFn: async () => {
      if (!args.taskId) {
        return null
      }

      return readTaskConversation({
        taskId: args.taskId,
      })
    },
    enabled: args.enabled && Boolean(args.taskId),
    staleTime: 5_000,
    refetchInterval(query) {
      const conversation = query.state.data
      if (!conversation || conversation.messages.length === 0) {
        return 4_000
      }

      return 8_000
    },
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
        queryKey: taskQueryKeys.detail(variables.taskId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.events(variables.taskId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.conversation(variables.taskId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(result.taskId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.events(result.taskId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.conversation(result.taskId),
      })

      if (result.task) {
        queryClient.setQueryData(taskQueryKeys.detail(result.taskId), result.task)
      }
    },
  })
}

export function filterTasksByStatus(
  tasks: TaskListItem[],
  statuses: TaskFilter["statuses"],
) {
  if (statuses.length === 0) {
    return tasks
  }

  const statusSet = new Set(statuses)
  return tasks.filter((task) => statusSet.has(task.status))
}

export function filterTasksByKeyword(tasks: TaskListItem[], keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) {
    return tasks
  }

  return tasks.filter((task) => {
    const prompt = task.prompt.toLowerCase()
    const taskId = task.taskId.toLowerCase()
    const model = task.model?.toLowerCase() ?? ""

    return (
      prompt.includes(normalizedKeyword) ||
      taskId.includes(normalizedKeyword) ||
      model.includes(normalizedKeyword)
    )
  })
}

export function filterTasksByTimeRange(
  tasks: TaskListItem[],
  timeRange: TaskFilter["timeRange"],
) {
  const now = Date.now()
  const diffMsByRange: Record<TaskFilter["timeRange"], number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  }

  const threshold = now - diffMsByRange[timeRange]

  return tasks.filter((task) => {
    const date = new Date(task.createdAt)
    return date.getTime() >= threshold
  })
}
