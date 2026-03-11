"use client"

import { useQuery } from "@tanstack/react-query"

import { readProjectGitDiff } from "../api/git-api-client"

export const gitQueryKeys = {
  all: ["git"] as const,
  byProject(projectId: string) {
    return [...this.all, "project", projectId] as const
  },
  diff(projectId: string) {
    return [...this.byProject(projectId), "diff"] as const
  },
}

export function useProjectGitDiffQuery(projectId: string) {
  return useQuery({
    queryKey: gitQueryKeys.diff(projectId),
    queryFn: async () => readProjectGitDiff(projectId),
    enabled: projectId.trim().length > 0,
  })
}
