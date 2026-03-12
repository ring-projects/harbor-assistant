"use client"

import { Settings2Icon } from "lucide-react"
import { useState } from "react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ProjectSettingsModal } from "@/modules/settings"
import { TaskWorkbench } from "@/modules/tasks"

type ProjectTaskWorkspaceProps = {
  projectId: string
}

export function ProjectTaskWorkspace({
  projectId,
}: ProjectTaskWorkspaceProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex h-12 items-center justify-between border-b px-3">
        <SidebarTrigger />

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            type="button"
            variant={isSettingsOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setIsSettingsOpen((current) => !current)}
          >
            <Settings2Icon className="size-4" />
            Settings
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <TaskWorkbench projectId={projectId} />
        <ProjectSettingsModal
          projectId={projectId}
          open={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </div>
  )
}
