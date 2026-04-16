"use client"

import { useEffect, useMemo } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { getErrorMessage } from "@/modules/tasks/view-models"
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
  const query = useProjectOrchestrationsQuery(projectId)

  const orchestrations = useMemo(
    () => query.data ?? [],
    [query.data],
  )

  const resolvedSelectedOrchestrationId = useMemo(() => {
    if (orchestrations.length === 0) {
      return null
    }

    if (
      selectedOrchestrationId &&
      orchestrations.some(
        (item) => item.id === selectedOrchestrationId,
      )
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
    <section className="min-h-0 bg-card/70 p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-foreground text-sm font-semibold">
              Orchestrations
            </p>
            <p className="text-muted-foreground text-xs">
              Work containers under this project.
            </p>
          </div>
          <OrchestrationCreateDialog
            projectId={projectId}
            onCreated={onSelectOrchestration}
          />
        </div>

        <div className="native-thin-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-2 pb-3">
            {query.isLoading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 rounded-lg" />
                ))
              : null}

            {!query.isLoading && query.isError ? (
              <div className="bg-surface-danger text-destructive rounded-md border border-destructive/25 p-3 text-xs">
                {getErrorMessage(query.error)}
              </div>
            ) : null}

            {!query.isLoading && !query.isError && orchestrations.length === 0 ? (
              <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                No orchestrations yet.
              </div>
            ) : null}

            {!query.isLoading && !query.isError
              ? orchestrations.map((orchestration) => {
                  const isActive = orchestration.id === resolvedSelectedOrchestrationId

                  return (
                    <button
                      key={orchestration.id}
                      type="button"
                      onClick={() => onSelectOrchestration(orchestration.id)}
                      className={[
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        isActive
                          ? "border-primary/40 bg-primary/8"
                          : "border-border/70 hover:bg-muted/40",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-semibold">
                            {orchestration.title}
                          </p>
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                            {orchestration.description ?? "No activity yet."}
                          </p>
                        </div>
                        <span className="text-muted-foreground shrink-0 text-[11px] uppercase">
                          {orchestration.status}
                        </span>
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
