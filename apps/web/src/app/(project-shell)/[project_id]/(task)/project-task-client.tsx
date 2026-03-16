"use client"

import { Settings2Icon } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { ProjectSwitcher } from "@/modules/projects/components"
import type { Project } from "@/modules/projects/types"
import { SettingsShell } from "@/modules/settings"
import { TaskWorkbench } from "@/modules/tasks"
import { useUiStore } from "@/stores/ui.store"

type ProjectTaskClientProps = {
  projectId: string
  initialProjects?: Project[]
}

export function ProjectTaskClient({
  projectId,
  initialProjects,
}: ProjectTaskClientProps) {
  const settingsOpen = useUiStore((state) => state.settingsOpen)
  const settingsScope = useUiStore((state) => state.settingsScope)
  const settingsProjectId = useUiStore((state) => state.settingsProjectId)
  const openSettings = useUiStore((state) => state.openSettings)
  const closeSettings = useUiStore((state) => state.closeSettings)
  const isSettingsOpen =
    settingsOpen &&
    settingsScope === "project" &&
    settingsProjectId === projectId

  function handleSettingsClick() {
    if (isSettingsOpen) {
      closeSettings()
      return
    }

    openSettings({
      scope: "project",
      projectId,
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex h-14 items-center justify-between gap-3 border-b px-4">
        <ProjectSwitcher
          activeProjectId={projectId}
          initialProjects={initialProjects}
        />

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            type="button"
            variant={isSettingsOpen ? "secondary" : "outline"}
            size="sm"
            onClick={handleSettingsClick}
          >
            <Settings2Icon className="size-4" />
            Settings
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <TaskWorkbench projectId={projectId} />
        <SettingsShell projectId={projectId} />
      </div>
    </div>
  )
}
