"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { getTaskSocketManager } from "@/modules/tasks/realtime/task-socket-manager"

export function useProjectGitStream(projectId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const normalizedProjectId = projectId.trim()
    if (!normalizedProjectId) {
      return
    }

    const manager = getTaskSocketManager()
    manager.bindQueryClient(queryClient)

    return manager.subscribeProjectGit(normalizedProjectId)
  }, [projectId, queryClient])
}
