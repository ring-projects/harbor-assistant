"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { getTaskSocketManager } from "@/modules/tasks/realtime/task-socket-manager"

export function useProjectTaskListStream(args: {
  projectId: string
  enabled?: boolean
}) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!args.enabled) {
      return
    }

    const manager = getTaskSocketManager()
    manager.bindQueryClient(queryClient)

    return manager.subscribeProject(args.projectId)
  }, [args.enabled, args.projectId, queryClient])
}
