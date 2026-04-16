"use client"

import { useMemo } from "react"

import { cn } from "@/lib/utils"
import { useProjectQuery } from "@/modules/projects/hooks"

type CurrentProjectNameProps = {
  projectId: string
  className?: string
}

export function CurrentProjectName({
  projectId,
  className,
}: CurrentProjectNameProps) {
  const projectQuery = useProjectQuery(projectId)

  const activeProject = useMemo(
    () => projectQuery.data ?? null,
    [projectQuery.data],
  )

  return (
    <span className={cn("truncate font-medium", className)}>
      {activeProject?.name ?? ""}
    </span>
  )
}
