"use client"

import { useMemo } from "react"

import { cn } from "@/lib/utils"
import { useReadProjectsQuery } from "@/modules/projects/hooks"
import { useAppStore } from "@/stores/app.store"

type CurrentProjectNameProps = {
  className?: string
}

export function CurrentProjectName({
  className,
}: CurrentProjectNameProps) {
  const activeProjectId = useAppStore((state) => state.activeProjectId)
  const projectsQuery = useReadProjectsQuery()

  const activeProject = useMemo(
    () =>
      projectsQuery.data?.find((project) => project.id === activeProjectId) ??
      null,
    [activeProjectId, projectsQuery.data],
  )

  return (
    <span className={cn("truncate font-medium", className)}>
      {activeProject?.name ?? ""}
    </span>
  )
}
