"use client"

import { PlusIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  EffortDropdown,
  ExecutorDropdown,
  ModelDropdown,
} from "@/modules/tasks/components"
import { useTaskCreationParams } from "@/modules/tasks/features/task-create/use-task-creation-params"
import {
  formatEffortLabel,
  formatExecutionModeLabel,
  formatExecutorLabel,
  getErrorMessage,
  getPromptSummary,
} from "@/modules/tasks/view-models/task-display"
import {
  useCreateOrchestrationMutation,
  useUpsertOrchestrationScheduleMutation,
} from "@/modules/orchestrations/hooks"
import { SCHEDULE_CRON_PRESETS } from "@/modules/orchestrations/schedule-presets"

type OrchestrationScheduleCreateDialogProps = {
  projectId: string
  onCreated: (orchestrationId: string) => void
}

function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

export function OrchestrationScheduleCreateDialog({
  projectId,
  onCreated,
}: OrchestrationScheduleCreateDialogProps) {
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [cronExpression, setCronExpression] = useState("")
  const [timezone, setTimezone] = useState(getLocalTimeZone)
  const [scheduledPrompt, setScheduledPrompt] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const taskCreationParams = useTaskCreationParams()
  const createOrchestrationMutation = useCreateOrchestrationMutation(projectId)
  const upsertScheduleMutation =
    useUpsertOrchestrationScheduleMutation(projectId)

  const isPending =
    createOrchestrationMutation.isPending || upsertScheduleMutation.isPending

  const runtimeSummary =
    taskCreationParams.model && taskCreationParams.effort
      ? [
          formatExecutorLabel(taskCreationParams.executor),
          taskCreationParams.model,
          formatExecutionModeLabel(taskCreationParams.executionMode),
          formatEffortLabel(taskCreationParams.effort),
        ].join(" · ")
      : null

  function reset() {
    setEnabled(true)
    setCronExpression("")
    setTimezone(getLocalTimeZone())
    setScheduledPrompt("")
    setErrorMessage(null)
  }

  async function handleSubmit() {
    const normalizedCronExpression = cronExpression.trim()
    const normalizedTimezone = timezone.trim() || getLocalTimeZone()
    const normalizedPrompt = scheduledPrompt.trim()

    if (!normalizedPrompt) {
      setErrorMessage("Enter a prompt before creating the schedule.")
      return
    }

    if (!normalizedCronExpression) {
      setErrorMessage("Enter a cron expression before creating the schedule.")
      return
    }

    if (!taskCreationParams.model || !taskCreationParams.effort) {
      setErrorMessage(
        "Wait for runtime defaults to load before creating the schedule.",
      )
      return
    }

    try {
      setErrorMessage(null)
      const orchestration = await createOrchestrationMutation.mutateAsync({
        title: getPromptSummary(normalizedPrompt),
      })

      await upsertScheduleMutation.mutateAsync({
        orchestrationId: orchestration.id,
        enabled,
        cronExpression: normalizedCronExpression,
        timezone: normalizedTimezone,
        taskTemplate: {
          prompt: normalizedPrompt,
          executor: taskCreationParams.executor,
          model: taskCreationParams.model,
          executionMode: taskCreationParams.executionMode,
          effort: taskCreationParams.effort,
        },
      })

      reset()
      setOpen(false)
      onCreated(orchestration.id)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen && !isPending) {
          reset()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="shrink-0">
          <PlusIcon className="size-4" />
          Create Schedule
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Schedule</DialogTitle>
          <DialogDescription>
            Create a session and configure its recurring run in one step.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
        >
          <label className="grid gap-2">
            <span className="text-sm font-medium">Scheduled prompt</span>
            <Textarea
              value={scheduledPrompt}
              onChange={(event) => setScheduledPrompt(event.target.value)}
              placeholder="Describe what this scheduled run should do."
              disabled={isPending}
              rows={6}
            />
          </label>

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
                  disabled={isPending}
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
              disabled={isPending}
            />
            <span className="text-muted-foreground text-xs">
              Standard 5-field cron. Example: every 5 minutes uses{" "}
              <code>*/5 * * * *</code>.
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Timezone</span>
              <Input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="Asia/Shanghai"
                disabled={isPending}
              />
            </label>

            <div className="border-border/60 bg-secondary/35 flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Active</p>
                <p className="text-muted-foreground text-xs">
                  Turn on the schedule immediately.
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="border-border/60 bg-card grid gap-3 rounded-lg border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Runtime</p>
              <p className="text-muted-foreground text-xs">
                New schedules use the current project runtime defaults.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ExecutorDropdown
                disabled={isPending}
                value={taskCreationParams.executor}
                onValueChange={taskCreationParams.setExecutor}
              />

              <ModelDropdown
                disabled={isPending}
                executor={taskCreationParams.executor}
                models={taskCreationParams.availableModels}
                value={taskCreationParams.model}
                onValueChange={taskCreationParams.setModel}
              />

              <EffortDropdown
                disabled={isPending}
                efforts={taskCreationParams.availableEfforts}
                value={taskCreationParams.effort}
                onValueChange={(nextEffort) => {
                  if (nextEffort) {
                    taskCreationParams.setEffort(nextEffort)
                  }
                }}
              />
            </div>

            {runtimeSummary ? (
              <p className="text-muted-foreground text-xs">{runtimeSummary}</p>
            ) : null}
          </div>

          {errorMessage ? (
            <div className="bg-surface-danger text-destructive border-destructive/25 rounded-md border px-3 py-2 text-xs">
              {errorMessage}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              Create Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
