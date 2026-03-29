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
  readProjectTasks,
  readTaskDetail,
  readTaskEvents,
  type CreateTaskInput,
  type CancelTaskInput,
  type ResumeTaskInput,
  resumeTask,
  uploadTaskInputImage,
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
  agentCapabilities() {
    return [...this.all, "agent-capabilities"] as const
  },
}

export function useTaskListQuery(args: {
  projectId: string
}) {
  const query = useQuery({
    queryKey: taskQueryKeys.list(args.projectId),
    queryFn: async () => {
      const result = await readProjectTasks({
        projectId: args.projectId,
        includeArchived: true,
      })

      return result.tasks
    },
    staleTime: 5_000,
  })

  useEffect(() => {
    if (!query.data) {
      return
    }

    useTasksSessionStore.getState().hydrateProjectTasks(args.projectId, query.data)
  }, [args.projectId, query.data])

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
    staleTime: 30_000,
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
        useTasksSessionStore.getState().applyTaskUpsert(result.task)
      }
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.events(result.taskId),
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
        queryKey: taskQueryKeys.byProject(projectId),
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
        queryKey: taskQueryKeys.byProject(projectId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(task.taskId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.events(task.taskId),
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
        queryKey: taskQueryKeys.byProject(projectId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(task.taskId),
      })
      void queryClient.invalidateQueries({
        queryKey: taskQueryKeys.events(task.taskId),
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
        queryKey: taskQueryKeys.byProject(projectId),
      })
      void queryClient.removeQueries({
        queryKey: taskQueryKeys.detail(result.taskId),
      })
      void queryClient.removeQueries({
        queryKey: taskQueryKeys.events(result.taskId),
      })

      useTasksSessionStore.getState().deleteTask(result.projectId, result.taskId)
    },
  })
}
