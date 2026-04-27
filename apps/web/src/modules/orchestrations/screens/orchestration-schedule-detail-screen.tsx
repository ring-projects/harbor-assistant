"use client"

import { Settings2Icon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  OrchestrationScheduleDrawer,
  OrchestrationScheduleRunList,
} from "@/modules/orchestrations"
import { useOrchestrationDetailQuery } from "@/modules/orchestrations/hooks"
import { TaskSessionPanel } from "@/modules/tasks/features/task-session"

type OrchestrationScheduleDetailScreenProps = {
  projectId: string
  orchestrationId: string
}

export function OrchestrationScheduleDetailScreen({
  projectId,
  orchestrationId,
}: OrchestrationScheduleDetailScreenProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const orchestrationQuery = useOrchestrationDetailQuery(orchestrationId)

  return (
    <div className="h-full min-h-0 w-full max-w-full overflow-hidden">
      <div className="border-border/60 bg-card flex items-start justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">
            {orchestrationQuery.data?.title ?? "Schedule"}
          </p>
          <p className="text-muted-foreground text-xs">
            Review each run and inspect the output for this schedule.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => setDrawerOpen(true)}
        >
          <Settings2Icon className="size-4" />
          Edit Schedule
        </Button>
      </div>

      <div className="bg-background divide-border/60 grid h-[calc(100%-57px)] min-h-0 w-full max-w-full grid-cols-1 divide-y xl:auto-rows-[minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] xl:divide-x xl:divide-y-0">
        <OrchestrationScheduleRunList
          orchestrationId={orchestrationId}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />

        <TaskSessionPanel
          projectId={projectId}
          orchestrationId={orchestrationId}
          taskId={selectedTaskId}
          emptyStateMessage="This schedule does not have runs yet."
          showComposer={false}
        />
      </div>

      <OrchestrationScheduleDrawer
        open={drawerOpen}
        projectId={projectId}
        orchestrationId={orchestrationId}
        onOpenChange={setDrawerOpen}
      />
    </div>
  )
}
