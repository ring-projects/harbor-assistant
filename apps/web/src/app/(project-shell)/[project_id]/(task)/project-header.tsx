"use client"

import { HarborLogo } from "@/components/logo"
import { SettingsButton, ThemeToggle } from "@/modules/app"
import { ProjectSwitcher } from "@/modules/projects/components"
import type { Project } from "@/modules/projects/types"
import { Separator } from "@/components/ui/separator"

type ProjectHeaderProps = {
  projectId: string
  initialProjects?: Project[]
}

export function ProjectHeader({
  projectId,
  initialProjects,
}: ProjectHeaderProps) {
  return (
    <div>
      <header className="flex h-14 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <HarborLogo className="w-24 shrink-0" />
          <ProjectSwitcher
            activeProjectId={projectId}
            initialProjects={initialProjects}
          />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SettingsButton projectId={projectId} />
        </div>
      </header>
      <Separator className="bg-border/30" />
    </div>
  )
}
