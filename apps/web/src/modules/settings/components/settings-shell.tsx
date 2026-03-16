"use client"

import { Settings2Icon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUiStore } from "@/stores/ui.store"

import { GeneralSettingsView } from "./general-settings-view"
import { ProjectSettingsView } from "./project-settings-view"

type SettingsShellProps = {
  projectId: string
}

export function SettingsShell({ projectId }: SettingsShellProps) {
  const settingsOpen = useUiStore((state) => state.settingsOpen)
  const settingsScope = useUiStore((state) => state.settingsScope)
  const settingsProjectId = useUiStore((state) => state.settingsProjectId)
  const closeSettings = useUiStore((state) => state.closeSettings)
  const setSettingsScope = useUiStore((state) => state.setSettingsScope)

  const open =
    settingsOpen &&
    (settingsScope === "general" || settingsProjectId === projectId)

  useEffect(() => {
    if (!open) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSettings()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [closeSettings, open])

  if (!open) {
    return null
  }

  return (
    <div className="absolute inset-0 z-20 bg-background/75 p-3 backdrop-blur-sm">
      <div className="bg-background h-full overflow-hidden rounded-xl border shadow-2xl">
        <Tabs
          value={settingsScope}
          onValueChange={(value) => setSettingsScope(value as "general" | "project")}
          orientation="vertical"
          className="h-full min-h-0 gap-0 lg:grid lg:grid-cols-[240px_minmax(0,1fr)]"
        >
          <aside className="bg-muted/20 border-b p-3 lg:border-r lg:border-b-0">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="bg-background rounded-lg border p-2 shadow-sm">
                    <Settings2Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Settings</p>
                    <p className="text-muted-foreground text-xs">
                      One place for Harbor defaults and project overrides
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeSettings}
              >
                <XIcon className="size-4" />
                <span className="sr-only">Close settings</span>
              </Button>
            </div>

            <TabsList
              variant="line"
              className="grid w-full gap-1 rounded-xl border bg-background p-1"
            >
              <TabsTrigger value="general" className="justify-start px-3 py-2">
                <SlidersHorizontalIcon className="size-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="project" className="justify-start px-3 py-2">
                <Settings2Icon className="size-4" />
                Current Project
              </TabsTrigger>
            </TabsList>

            <div className="text-muted-foreground mt-3 rounded-xl border bg-background px-3 py-2 text-xs leading-5">
              {settingsScope === "general"
                ? "General defines Harbor-wide defaults. Project settings can inherit these values."
                : `Current Project applies only to ${projectId}. Use this area for repository-specific overrides.`}
            </div>
          </aside>

          <TabsContent value="general" className="min-h-0 overflow-hidden">
            <GeneralSettingsView />
          </TabsContent>

          <TabsContent value="project" className="min-h-0 overflow-hidden">
            <ProjectSettingsView projectId={projectId} mode="modal" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
