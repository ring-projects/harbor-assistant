"use client"

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useOrchestrationDetailQuery } from "@/modules/orchestrations/hooks"
import { OrchestrationScheduleEditor } from "./orchestration-schedule-editor"

type OrchestrationScheduleDrawerProps = {
  open: boolean
  projectId: string
  orchestrationId: string | null
  onOpenChange: (open: boolean) => void
}

export function OrchestrationScheduleDrawer({
  open,
  projectId,
  orchestrationId,
  onOpenChange,
}: OrchestrationScheduleDrawerProps) {
  const orchestrationQuery = useOrchestrationDetailQuery(orchestrationId)

  return (
    <Drawer open={open} direction="right" onOpenChange={onOpenChange}>
      <DrawerContent className="data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-[440px]">
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
          <DrawerHeader className="border-border/60 border-b">
            <DrawerTitle>Schedule</DrawerTitle>
            <DrawerDescription>
              Update runtime and recurring run settings for the selected
              session.
            </DrawerDescription>
          </DrawerHeader>

          <div className="min-h-0 p-4">
            <OrchestrationScheduleEditor
              orchestration={orchestrationQuery.data ?? null}
              projectId={projectId}
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
