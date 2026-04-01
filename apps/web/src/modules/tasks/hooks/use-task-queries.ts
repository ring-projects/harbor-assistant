"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { gitQueryKeys } from "@/modules/git"
import { useTasksSessionStore } from "@/modules/tasks/store"
import {
  archiveTask,
  cancelTask,
  createTask,
  deleteTask,
  readAgentCapabilities,
  readOrchestrationTasks,
  readTaskDetail,
  readTaskEvents,
  type CreateTaskInput,
  type CancelTaskInput,
  type ResumeTaskInput,
  resumeTask,
  uploadTaskInputImage,
} from "@/modules/tasks/api"
export { useTaskEventStream } from "./use-task-event-stream"

export const taskQueryKeys = {
  all: ["tasks"] as const,
  byOrchestration(orchestrationId: string) {
    return [...this.all, "orchestration", orchestrationId] as const
  },
  listByOrchestration(orchestrationId: string) {
    return [...this.byOrchestration(orchestrationId), "list"] as const
  },
  detail(taskId: string) {
    return [...this.all, "detail", taskId] as const
  },
  events(taskId: string) {
    return [...this.all, "events", taskId] as const
  },
  agentCapabilities() {
    return [...this.all, "agent-capabilities"] as const
  },
}

export function useOrchestrationTaskListQuery(args: {
  orchestrationId: string | null
}) {
  const query = useQuery({
    queryKey: taskQueryKeys.listByOrchestration(args.orchestrationId ?? "none"),
    queryFn: async () => {
      if (!args.orchestrationId) {
        return []
      }

      const result = await readOrchestrationTasks({
        orchestrationId: args.orchestrationId,
        includeArchived: true,
      })

      return result.tasks
    },
    enabled: Boolean(args.orchestrationId),
    staleTime: 5_000,
  })

  useEffect(() => {
    if (!query.data) {
      return
    }

    if (!args.orchestrationId) {
      return
    }

    useTasksSessionStore
      .getState()
      .hydrateOrchestrationTasks(args.orchestrationId, query.data)
  }, [args.orchestrationId, query.data])

  return query
}

export function useTaskDetailQuery(taskId: string | null) {
  const query = useQuery({
    queryKey: taskQueryKeys.detail(taskId ?? "none"),
    queryFn: async () => {
      if (!taskId) {
        return null
      }

      return readTaskDetail(taskId)
    },
    enabled: Boolean(taskId),
  })

  useEffect(() => {
    if (!query.data) {
      return
    }

    useTasksSessionStore.getState().hydrateTaskDetail(query.data)
  }, [query.data])

  return query
}

export function useTaskEventsQuery(args: {
  taskId: string | null
  enabled: boolean
}) {
  const query = useQuery({
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

  useEffect(() => {
    if (!args.taskId || !query.data) {
      return
    }

    useTasksSessionStore.getState().hydrateTaskEvents(args.taskId, query.data)
  }, [args.taskId, query.data])

  return query
}

export function useAgentCapabilitiesQuery(args?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taskQueryKeys.agentCapabilities(),
    queryFn: readAgentCapabilities,
    enabled: args?.enabled ?? true,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  })
}

export function useCreateTaskMutation(args: {
  projectId: string
  orchestrationId?: string | null
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateTaskInput) => {
      if (!args.orchestrationId) {
        throw new Error("orchestrationId is required to create a task")
      }

      return createTask({
        projectId: args.projectId,
        orchestrationId: args.orchestrationId,
        input,
      })
    },
    onSuccess(result) {
      void queryClient.invalidateQueries({
        queryKey: gitQueryKeys.byProject(args.projectId),
      })
      if (args.orchestrationId) {
        void queryClient.invalidateQueries({
          queryKey: taskQueryKeys.byOrchestration(args.orchestrationId),
        })
      }

      if (result.task) {
        useTasksSessionStore.getState().applyTaskUpsert(result.task)
      }
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.events(result.id),
      })
    },
  })
}

export function useArchiveTaskMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => archiveTask(taskId),
    onSuccess(task) {
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.byOrchestration(task.orchestrationId),
      })

      useTasksSessionStore.getState().applyTaskUpsert(task)
    },
  })
}

export function useCancelTaskMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { taskId: string } & CancelTaskInput) =>
      cancelTask(input.taskId, input),
    onSuccess(task) {
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.byOrchestration(task.orchestrationId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(task.id),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.events(task.id),
      })

      useTasksSessionStore.getState().applyTaskUpsert(task)
    },
  })
}

export function useResumeTaskMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { taskId: string } & ResumeTaskInput) =>
      resumeTask(input.taskId, input),
    onSuccess(task) {
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.byOrchestration(task.orchestrationId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(task.id),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.events(task.id),
      })

      useTasksSessionStore.getState().applyTaskUpsert(task)
    },
  })
}

export function useUploadTaskInputImageMutation(projectId: string) {
  return useMutation({
    mutationFn: (input: { file: File }) => uploadTaskInputImage(projectId, input),
  })
}

export function useDeleteTaskMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess(result) {
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.byOrchestration(result.orchestrationId),
      })
      void queryClient.removeQueries({
        queryKey: taskQueryKeys.detail(result.taskId),
      })
      void queryClient.removeQueries({
        queryKey: taskQueryKeys.events(result.taskId),
      })

      useTasksSessionStore
        .getState()
        .deleteTask(result.orchestrationId, result.taskId)
    },
  })
}
