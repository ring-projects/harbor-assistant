"use client"

import { SettingsIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useUiStore } from "@/stores/ui.store"

type SettingsButtonProps = {
  projectId: string
}

export function SettingsButton({ projectId }: SettingsButtonProps) {
  const settingsOpen = useUiStore((state) => state.settingsOpen)
  const settingsProjectId = useUiStore((state) => state.settingsProjectId)
  const openSettings = useUiStore((state) => state.openSettings)
  const closeSettings = useUiStore((state) => state.closeSettings)
  const isSettingsOpen = settingsOpen && settingsProjectId === projectId

  function handleClick() {
    if (isSettingsOpen) {
      closeSettings()
      return
    }

    openSettings(projectId)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
    >
      <SettingsIcon className="size-4" />
    </Button>
  )
}
