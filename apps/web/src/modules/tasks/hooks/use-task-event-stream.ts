"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { getTaskSocketManager } from "@/modules/tasks/realtime/task-socket-manager"

export function useTaskEventStream(args: {
  projectId: string
  taskId: string | null
  enabled: boolean
}) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!args.enabled || !args.taskId) {
      return
    }

    const manager = getTaskSocketManager()
    manager.bindQueryClient(queryClient)

    const unsubscribeTask = manager.subscribeTask(args.taskId)
    const unsubscribeTaskEvents = manager.subscribeTaskEvents(args.taskId)

    return () => {
      unsubscribeTaskEvents()
      unsubscribeTask()
    }
  }, [args.enabled, args.projectId, args.taskId, queryClient])
}
