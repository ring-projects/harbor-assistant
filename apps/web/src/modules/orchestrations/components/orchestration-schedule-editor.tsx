"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime } from "@/lib/date-time"
import type { OrchestrationDetail } from "@/modules/orchestrations/contracts"
import { useUpsertOrchestrationScheduleMutation } from "@/modules/orchestrations/hooks"
import { SCHEDULE_CRON_PRESETS } from "@/modules/orchestrations/schedule-presets"
import { useTaskCreationParams } from "@/modules/tasks/features/task-create/use-task-creation-params"
import {
  formatEffortLabel,
  formatExecutionModeLabel,
  formatExecutorLabel,
  getErrorMessage,
} from "@/modules/tasks/view-models"

type OrchestrationScheduleEditorProps = {
  orchestration: OrchestrationDetail | null
  projectId: string
}

function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

export function OrchestrationScheduleEditor({
  orchestration,
  projectId,
}: OrchestrationScheduleEditorProps) {
  const [enabled, setEnabled] = useState(true)
  const [cronExpression, setCronExpression] = useState("")
  const [timezone, setTimezone] = useState(getLocalTimeZone)
  const [scheduledPrompt, setScheduledPrompt] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const mutation = useUpsertOrchestrationScheduleMutation(projectId)
  const taskCreationParams = useTaskCreationParams()

  const schedule = orchestration?.schedule ?? null
  const existingItems = schedule?.taskTemplate.items ?? []
  const runtimeExecutor =
    schedule?.taskTemplate.executor ?? taskCreationParams.executor
  const runtimeModel = schedule?.taskTemplate.model ?? taskCreationParams.model
  const runtimeEffort =
    schedule?.taskTemplate.effort ?? taskCreationParams.effort
  const runtimeExecutionMode = "full-access" as const

  useEffect(() => {
    setEnabled(schedule?.enabled ?? true)
    setCronExpression(schedule?.cronExpression ?? "")
    setTimezone(schedule?.timezone ?? getLocalTimeZone())
    setScheduledPrompt(schedule?.taskTemplate.prompt ?? "")
    setErrorMessage(null)
  }, [schedule, orchestration?.id])

  const runtimeSummary = useMemo(() => {
    if (!runtimeModel || !runtimeEffort) {
      return null
    }

    return [
      formatExecutorLabel(runtimeExecutor),
      runtimeModel,
      formatEffortLabel(runtimeEffort),
      formatExecutionModeLabel(runtimeExecutionMode),
    ].join(" · ")
  }, [runtimeEffort, runtimeExecutionMode, runtimeExecutor, runtimeModel])

  async function handleSubmit() {
    if (!orchestration) {
      return
    }

    const normalizedCronExpression = cronExpression.trim()
    const normalizedTimezone = timezone.trim() || getLocalTimeZone()
    const normalizedPrompt = scheduledPrompt.trim()

    if (!normalizedCronExpression) {
      setErrorMessage("Enter a cron expression before saving the schedule.")
      return
    }

    if (!normalizedPrompt && existingItems.length === 0) {
      setErrorMessage("Enter a scheduled prompt before saving the schedule.")
      return
    }

    if (!runtimeModel || !runtimeEffort) {
      setErrorMessage(
        "Wait for runtime defaults to load before saving the schedule.",
      )
      return
    }

    try {
      setErrorMessage(null)
      await mutation.mutateAsync({
        orchestrationId: orchestration.id,
        enabled,
        cronExpression: normalizedCronExpression,
        timezone: normalizedTimezone,
        taskTemplate: {
          title: null,
          prompt: normalizedPrompt || null,
          items: normalizedPrompt ? undefined : existingItems,
          executor: runtimeExecutor,
          model: runtimeModel,
          executionMode: runtimeExecutionMode,
          effort: runtimeEffort,
        },
      })
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  if (!orchestration) {
    return (
      <div className="text-muted-foreground bg-background/25 flex min-h-0 items-center justify-center rounded-lg font-mono text-[12px]">
        Select a schedule to edit its configuration.
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="space-y-1">
        <p className="line-clamp-2 text-sm font-semibold">
          {orchestration.title}
        </p>
        <p className="text-muted-foreground text-xs">
          Recurring run configuration.
        </p>
      </div>

      <div className="native-thin-scrollbar min-h-0 overflow-y-auto">
        <form
          className="grid gap-4 pb-4"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
        >
          <div className="bg-muted/45 flex items-start justify-between gap-4 rounded-lg px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-muted-foreground text-xs">
                Run this session automatically on the configured cron schedule.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={mutation.isPending}
            />
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Cron expression</span>
            <div className="flex flex-wrap gap-2">
              {SCHEDULE_CRON_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full px-3 text-[11px]"
                  disabled={mutation.isPending}
                  onClick={() => setCronExpression(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Input
              value={cronExpression}
              onChange={(event) => setCronExpression(event.target.value)}
              placeholder="0 9 * * mon-fri"
              disabled={mutation.isPending}
            />
            <span className="text-muted-foreground text-xs">
              Standard 5-field cron. Example: every 5 minutes uses{" "}
              <code>*/5 * * * *</code>.
            </span>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Timezone</span>
            <Input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="Asia/Shanghai"
              disabled={mutation.isPending}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Scheduled prompt</span>
            <Textarea
              value={scheduledPrompt}
              onChange={(event) => setScheduledPrompt(event.target.value)}
              placeholder="Describe what this scheduled run should do."
              disabled={mutation.isPending}
              rows={6}
            />
          </label>

          {runtimeSummary ? (
            <div className="bg-muted/35 rounded-lg px-4 py-3">
              <p className="text-muted-foreground text-[11px] tracking-[0.12em] uppercase">
                Runtime
              </p>
              <p className="mt-2 text-sm">{runtimeSummary}</p>
            </div>
          ) : null}

          {schedule ? (
            <div className="bg-muted/35 grid gap-2 rounded-lg px-4 py-3 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Next run</span>
                <span>{formatDateTime(schedule.nextTriggerAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Last run</span>
                <span>{formatDateTime(schedule.lastTriggeredAt)}</span>
              </div>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="bg-surface-danger text-destructive border-destructive/25 rounded-md border px-3 py-2 text-xs">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              Save Schedule
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
