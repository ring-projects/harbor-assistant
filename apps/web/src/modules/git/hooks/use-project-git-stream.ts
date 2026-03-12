"use client"

import { useEffect } from "react"

import { getTaskSocketManager } from "@/modules/tasks/realtime/task-socket-manager"

export function useProjectGitStream(projectId: string) {
  useEffect(() => {
    const normalizedProjectId = projectId.trim()
    if (!normalizedProjectId) {
      return
    }

    return getTaskSocketManager().subscribeProjectGit(normalizedProjectId)
  }, [projectId])
}
