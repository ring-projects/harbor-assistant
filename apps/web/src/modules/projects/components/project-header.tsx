"use client"

import { ThemeToggle } from "@/modules/app"
import { CurrentProjectName } from "@/modules/projects/components"

type ProjectHeaderProps = {
  projectId: string
}

export function ProjectHeader({ projectId }: ProjectHeaderProps) {
  return (
    <div>
      <header className="border-border/60 flex h-14 items-center justify-between gap-3 border-b px-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <CurrentProjectName projectId={projectId} />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>
    </div>
  )
}
