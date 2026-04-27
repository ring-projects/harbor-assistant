"use client"

import { Settings2Icon, XIcon } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { useUiStore } from "@/stores/ui.store"

import { GeneralSettingsView } from "./general-settings-view"
import { ProjectSettingsView } from "./project-settings-view"

type SettingsShellProps = {
  projectId: string
}

export function SettingsShell({ projectId }: SettingsShellProps) {
  const settingsOpen = useUiStore((state) => state.settingsOpen)
  const settingsProjectId = useUiStore((state) => state.settingsProjectId)
  const closeSettings = useUiStore((state) => state.closeSettings)
  const open = settingsOpen
  const isProjectSettings = settingsProjectId !== null

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
    <div className="bg-background/75 absolute inset-0 z-20 p-3 backdrop-blur-sm">
      <div className="bg-background h-full overflow-hidden rounded-xl border shadow-2xl">
        <div className="flex h-full min-h-0 flex-col">
          <div className="bg-muted/20 border-b px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="bg-background rounded-lg border p-2 shadow-sm">
                    <Settings2Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Settings</p>
                    <p className="text-muted-foreground text-xs">
                      {isProjectSettings
                        ? `Current project settings for ${settingsProjectId}`
                        : "Harbor-wide defaults and preferences"}
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
            <div className="text-muted-foreground bg-background mt-3 rounded-xl border px-3 py-2 text-xs leading-5">
              {isProjectSettings
                ? `Current Project applies only to ${settingsProjectId}. Use this area for repository-specific overrides.`
                : "General defines Harbor-wide defaults. Project settings can inherit these values."}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {isProjectSettings ? (
              <ProjectSettingsView
                projectId={settingsProjectId ?? projectId}
                mode="modal"
              />
            ) : (
              <GeneralSettingsView />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
