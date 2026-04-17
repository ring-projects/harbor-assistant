"use client"

import { ProjectSettingsView } from "@/modules/settings"

type ProjectSettingsScreenProps = {
  projectId: string
}

export function ProjectSettingsScreen({
  projectId,
}: ProjectSettingsScreenProps) {
  return (
    <div className="h-full overflow-auto">
      <ProjectSettingsView projectId={projectId} />
    </div>
  )
}
