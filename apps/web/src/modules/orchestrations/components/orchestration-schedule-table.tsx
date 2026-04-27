"use client"

import { useNavigate } from "@tanstack/react-router"
import { EllipsisIcon } from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatDateTime, formatRelativeTimeShort } from "@/lib/date-time"
import { useProjectOrchestrationsQuery } from "@/modules/orchestrations/hooks"
import type { OrchestrationListItem } from "@/modules/orchestrations/contracts"
import {
  formatEffortLabel,
  formatExecutionModeLabel,
  formatExecutorLabel,
  getErrorMessage,
} from "@/modules/tasks/view-models/task-display"
import { OrchestrationScheduleCreateDialog } from "./orchestration-schedule-create-dialog"

type OrchestrationScheduleTableProps = {
  workspaceId: string
  projectId: string
  activeOrchestrationId: string | null
  onEditOrchestration: (orchestrationId: string) => void
}

type ScheduledOrchestration = OrchestrationListItem & {
  schedule: NonNullable<OrchestrationListItem["schedule"]>
}

function isScheduledOrchestration(
  orchestration: OrchestrationListItem,
): orchestration is ScheduledOrchestration {
  return orchestration.schedule !== null
}

function getScheduleStatusMeta(orchestration: ScheduledOrchestration) {
  if (orchestration.schedule.enabled) {
    return {
      label: "Active",
      className: "border-success/25 bg-surface-success text-success",
    }
  }

  return {
    label: "Paused",
    className: "border-warning/25 bg-surface-warning text-warning",
  }
}

function getRuntimeSummary(orchestration: ScheduledOrchestration) {
  const schedule = orchestration.schedule

  return {
    primary: [
      formatExecutorLabel(schedule.taskTemplate.executor),
      schedule.taskTemplate.model,
    ].join(" · "),
    secondary: [
      formatExecutionModeLabel(schedule.taskTemplate.executionMode),
      formatEffortLabel(schedule.taskTemplate.effort),
    ].join(" · "),
  }
}

export function OrchestrationScheduleTable({
  workspaceId,
  projectId,
  activeOrchestrationId,
  onEditOrchestration,
}: OrchestrationScheduleTableProps) {
  const navigate = useNavigate()
  const query = useProjectOrchestrationsQuery(projectId, "schedule")
  const orchestrations = useMemo(
    () => (query.data ?? []).filter(isScheduledOrchestration),
    [query.data],
  )

  function openDetail(orchestrationId: string) {
    void navigate({
      to: "/workspaces/$workspaceId/projects/$projectId/schedule/$orchestrationId",
      params: {
        workspaceId,
        projectId,
        orchestrationId,
      },
    })
  }

  return (
    <section className="bg-background grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Schedules</p>
          <p className="text-muted-foreground text-xs">
            Manage recurring runs for project sessions.
          </p>
        </div>

        <OrchestrationScheduleCreateDialog
          projectId={projectId}
          onCreated={onEditOrchestration}
        />
      </div>

      <div className="border-border/60 bg-card min-h-0 overflow-hidden rounded-lg border">
        <div className="native-thin-scrollbar h-full overflow-auto">
          <Table className="min-w-[940px] text-left">
            <TableHeader className="bg-secondary/35">
              <TableRow className="border-border/60 hover:bg-secondary/35">
                <TableHead className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-[0.08em] uppercase">
                  Session
                </TableHead>
                <TableHead className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-[0.08em] uppercase">
                  Status
                </TableHead>
                <TableHead className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-[0.08em] uppercase">
                  Runtime
                </TableHead>
                <TableHead className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-[0.08em] uppercase">
                  Next Run
                </TableHead>
                <TableHead className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-[0.08em] uppercase">
                  Last Run
                </TableHead>
                <TableHead className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-[0.08em] uppercase">
                  Updated
                </TableHead>
                <TableHead className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-[0.08em] uppercase">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {query.isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <TableRow
                      key={index}
                      className="border-border/50 hover:bg-transparent"
                    >
                      <TableCell className="px-4 py-3">
                        <Skeleton className="h-12 w-full rounded-md" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="h-8 w-24 rounded-full" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="h-10 w-44 rounded-md" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="h-5 w-28 rounded-md" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="h-5 w-28 rounded-md" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="h-5 w-16 rounded-md" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="h-8 w-16 rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                : null}

              {!query.isLoading && query.isError ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="px-4 py-4">
                    <div className="bg-surface-danger text-destructive border-destructive/25 rounded-md border p-3 text-xs">
                      {getErrorMessage(query.error)}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}

              {!query.isLoading &&
              !query.isError &&
              orchestrations.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground px-4 py-10 text-center text-sm"
                  >
                    No schedules yet. Create one to start recurring runs.
                  </TableCell>
                </TableRow>
              ) : null}

              {!query.isLoading && !query.isError
                ? orchestrations.map((orchestration) => {
                    const isActive = orchestration.id === activeOrchestrationId
                    const status = getScheduleStatusMeta(orchestration)
                    const runtime = getRuntimeSummary(orchestration)

                    return (
                      <TableRow
                        key={orchestration.id}
                        data-state={isActive ? "selected" : undefined}
                        role="button"
                        tabIndex={0}
                        onClick={() => openDetail(orchestration.id)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") {
                            return
                          }

                          event.preventDefault()
                          openDetail(orchestration.id)
                        }}
                        className={cn(
                          "border-border/50 focus-visible:ring-foreground/15 cursor-pointer align-top focus-visible:ring-2 focus-visible:outline-none",
                          isActive
                            ? "bg-secondary/42 hover:bg-secondary/42"
                            : "hover:bg-secondary/18",
                        )}
                      >
                        <TableCell className="px-4 py-4 align-top whitespace-normal">
                          <div className="space-y-1.5">
                            <p className="line-clamp-1 text-sm font-semibold">
                              {orchestration.title}
                            </p>
                            {orchestration.description ? (
                              <p className="text-muted-foreground line-clamp-2 text-xs leading-5">
                                {orchestration.description}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-4 align-top">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
                              status.className,
                            )}
                          >
                            {status.label}
                          </span>
                        </TableCell>

                        <TableCell className="px-4 py-4 align-top whitespace-normal">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {runtime.primary}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {runtime.secondary}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-4 align-top text-sm">
                          {formatDateTime(
                            orchestration.schedule?.nextTriggerAt ?? null,
                          )}
                        </TableCell>

                        <TableCell className="px-4 py-4 align-top text-sm">
                          {formatDateTime(
                            orchestration.schedule?.lastTriggeredAt ?? null,
                          )}
                        </TableCell>

                        <TableCell className="text-muted-foreground px-4 py-4 align-top text-sm">
                          {formatRelativeTimeShort(orchestration.updatedAt)}
                        </TableCell>

                        <TableCell className="px-4 py-4 align-top">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            aria-label={`Edit schedule for ${orchestration.title}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              onEditOrchestration(orchestration.id)
                            }}
                          >
                            <EllipsisIcon className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}
