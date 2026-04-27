"use client"

import { useEffect, useMemo } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { getErrorMessage } from "@/modules/tasks/view-models"
import { formatRelativeTimeShort } from "@/lib/date-time"
import { useProjectOrchestrationsQuery } from "@/modules/orchestrations/hooks"
import { OrchestrationCreateDialog } from "./orchestration-create-dialog"

type OrchestrationListProps = {
  projectId: string
  selectedOrchestrationId: string | null
  onSelectOrchestration: (orchestrationId: string | null) => void
}

export function OrchestrationList({
  projectId,
  selectedOrchestrationId,
  onSelectOrchestration,
}: OrchestrationListProps) {
  const query = useProjectOrchestrationsQuery(projectId, "human-loop")

  const orchestrations = useMemo(() => query.data ?? [], [query.data])

  const resolvedSelectedOrchestrationId = useMemo(() => {
    if (orchestrations.length === 0) {
      return null
    }

    if (
      selectedOrchestrationId &&
      orchestrations.some((item) => item.id === selectedOrchestrationId)
    ) {
      return selectedOrchestrationId
    }

    return orchestrations[0]?.id ?? null
  }, [orchestrations, selectedOrchestrationId])

  useEffect(() => {
    if (resolvedSelectedOrchestrationId !== selectedOrchestrationId) {
      onSelectOrchestration(resolvedSelectedOrchestrationId)
    }
  }, [
    onSelectOrchestration,
    resolvedSelectedOrchestrationId,
    selectedOrchestrationId,
  ])

  return (
    <section className="bg-background h-full min-h-0 p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-foreground text-sm font-semibold">Sessions</p>
          <OrchestrationCreateDialog
            projectId={projectId}
            onCreated={onSelectOrchestration}
          />
        </div>

        <div className="native-thin-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-1.5 pb-3">
            {query.isLoading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 rounded-lg" />
                ))
              : null}

            {!query.isLoading && query.isError ? (
              <div className="bg-surface-danger text-destructive border-destructive/25 rounded-md border p-3 text-xs">
                {getErrorMessage(query.error)}
              </div>
            ) : null}

            {!query.isLoading &&
            !query.isError &&
            orchestrations.length === 0 ? (
              <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                No sessions yet.
              </div>
            ) : null}

            {!query.isLoading && !query.isError
              ? orchestrations.map((orchestration) => {
                  const isActive =
                    orchestration.id === resolvedSelectedOrchestrationId
                  const description = orchestration.description?.trim() ?? ""

                  return (
                    <button
                      key={orchestration.id}
                      type="button"
                      onClick={() => onSelectOrchestration(orchestration.id)}
                      className={[
                        "focus-visible:ring-foreground/20 w-full rounded-lg px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        isActive
                          ? "bg-secondary"
                          : "bg-card/78 hover:bg-accent/72",
                      ].join(" ")}
                    >
                      <div className="flex flex-col gap-2.5">
                        <div className="min-w-0">
                          <p className="line-clamp-3 text-[15px] leading-6 font-semibold tracking-[-0.02em] text-balance">
                            {orchestration.title}
                          </p>
                          {description ? (
                            <p className="text-muted-foreground/88 mt-2 line-clamp-2 text-[13px] leading-5">
                              {description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center">
                          <span className="text-muted-foreground/72 block text-[11px] leading-none font-semibold">
                            {formatRelativeTimeShort(orchestration.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })
              : null}
          </div>
        </div>
      </div>
    </section>
  )
}
