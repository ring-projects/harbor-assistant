"use client"

import { useEffect } from "react"

import { ProjectSettingsView } from "./project-settings-view"

type ProjectSettingsModalProps = {
  projectId: string
  open: boolean
  onClose: () => void
}

export function ProjectSettingsModal({
  projectId,
  open,
  onClose,
}: ProjectSettingsModalProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, open])

  if (!open) {
    return null
  }

  return (
    <div className="absolute inset-0 z-20 bg-background/75 p-3 backdrop-blur-sm">
      <div className="h-full overflow-hidden rounded-xl border bg-background shadow-2xl">
        <ProjectSettingsView projectId={projectId} mode="modal" onClose={onClose} />
      </div>
    </div>
  )
}
