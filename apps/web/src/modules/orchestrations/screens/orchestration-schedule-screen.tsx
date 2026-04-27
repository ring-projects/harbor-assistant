"use client"

import { useState } from "react"

import {
  OrchestrationScheduleDrawer,
  OrchestrationScheduleTable,
} from "@/modules/orchestrations"

type OrchestrationScheduleScreenProps = {
  workspaceId: string
  projectId: string
}

export function OrchestrationScheduleScreen({
  workspaceId,
  projectId,
}: OrchestrationScheduleScreenProps) {
  const [activeOrchestrationId, setActiveOrchestrationId] = useState<
    string | null
  >(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="h-full min-h-0 w-full max-w-full overflow-hidden">
      <OrchestrationScheduleTable
        workspaceId={workspaceId}
        projectId={projectId}
        activeOrchestrationId={activeOrchestrationId}
        onEditOrchestration={(orchestrationId) => {
          setActiveOrchestrationId(orchestrationId)
          setDrawerOpen(true)
        }}
      />

      <OrchestrationScheduleDrawer
        open={drawerOpen}
        projectId={projectId}
        orchestrationId={activeOrchestrationId}
        onOpenChange={setDrawerOpen}
      />
    </div>
  )
}
