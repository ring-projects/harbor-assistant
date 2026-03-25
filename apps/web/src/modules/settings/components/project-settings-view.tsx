"use client"

import { useRouter } from "next/navigation"
import { RotateCcwIcon, SaveIcon, XIcon } from "lucide-react"
import { useMemo, useState, type ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getProjectActionError,
  type ProjectExecutionMode,
  type ProjectExecutor,
  type ProjectSettings,
  useDeleteProjectMutation,
  useProjectSettingsQuery,
  useUpdateProjectSettingsMutation,
} from "@/modules/projects"

type ProjectSettingsViewProps = {
  projectId: string
  mode?: "page" | "modal"
  onClose?: () => void
}

type SettingsDraft = {
  defaultExecutor: ProjectExecutor
  defaultExecutionMode: ProjectExecutionMode
  maxConcurrentTasks: string
  logRetentionDays: string
  eventRetentionDays: string
}

const EXECUTOR_OPTIONS: Array<{
  value: ProjectExecutor
  label: string
  description: string
}> = [
  {
    value: "codex",
    label: "Codex",
    description: "OpenAI Codex runtime",
  },
  {
    value: "claude-code",
    label: "Claude Code",
    description: "Anthropic Claude Code runtime",
  },
]

const EXECUTION_MODE_OPTIONS: Array<{
  value: ProjectExecutionMode
  label: string
  description: string
}> = [
  {
    value: "safe",
    label: "Safe",
    description: "Write workspace, no shell network, cached search",
  },
  {
    value: "connected",
    label: "Normal",
    description: "Write workspace, allow network, live search",
  },
  {
    value: "full-access",
    label: "Full Access",
    description: "Minimal restrictions, highest risk",
  },
]

function formatExecutionModeLabel(value: ProjectExecutionMode | null) {
  switch (value) {
    case "safe":
      return "Safe"
    case "connected":
      return "Normal"
    case "full-access":
      return "Full Access"
    default:
      return "-"
  }
}

function toDraft(settings: ProjectSettings): SettingsDraft {
  return {
    defaultExecutor: settings.execution.defaultExecutor ?? "codex",
    defaultExecutionMode: settings.execution.defaultExecutionMode ?? "connected",
    maxConcurrentTasks: String(settings.execution.maxConcurrentTasks),
    logRetentionDays:
      settings.retention.logRetentionDays === null
        ? ""
        : String(settings.retention.logRetentionDays),
    eventRetentionDays:
      settings.retention.eventRetentionDays === null
        ? ""
        : String(settings.retention.eventRetentionDays),
  }
}

function parsePositiveInteger(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseNullablePositiveInteger(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function SettingsField(props: {
  label: string
  description: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  type?: ComponentProps<typeof Input>["type"]
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{props.label}</span>
      <span className="text-muted-foreground text-xs">{props.description}</span>
      <Input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        type={props.type}
      />
    </label>
  )
}

export function ProjectSettingsView({
  projectId,
  mode = "page",
  onClose,
}: ProjectSettingsViewProps) {
  const router = useRouter()
  const settingsQuery = useProjectSettingsQuery(projectId)
  const updateMutation = useUpdateProjectSettingsMutation(projectId)
  const deleteMutation = useDeleteProjectMutation()
  const [draftOverride, setDraftOverride] = useState<SettingsDraft | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const baselineDraft = useMemo(
    () => (settingsQuery.data ? toDraft(settingsQuery.data) : null),
    [settingsQuery.data],
  )
  const draft = draftOverride ?? baselineDraft

  const hasChanges = useMemo(() => {
    if (!draftOverride || !baselineDraft) {
      return false
    }

    return JSON.stringify(draftOverride) !== JSON.stringify(baselineDraft)
  }, [baselineDraft, draftOverride])

  const shellClassName =
    mode === "modal"
      ? "bg-background flex h-full min-h-0 flex-col"
      : "bg-background flex min-h-full flex-col"

  async function handleSave() {
    if (!draft) {
      return
    }

    try {
      setSaveError(null)
      const nextProject = await updateMutation.mutateAsync({
        execution: {
          defaultExecutor: draft.defaultExecutor,
          defaultExecutionMode: draft.defaultExecutionMode,
          maxConcurrentTasks: parsePositiveInteger(draft.maxConcurrentTasks, 1),
        },
        retention: {
          logRetentionDays: parseNullablePositiveInteger(draft.logRetentionDays),
          eventRetentionDays: parseNullablePositiveInteger(draft.eventRetentionDays),
        },
      })

      setDraftOverride(toDraft(nextProject.settings))
      setSaveSuccessMessage("Project settings saved.")
    } catch (error) {
      setSaveSuccessMessage(null)
      setSaveError(getProjectActionError(error))
    }
  }

  function handleReset() {
    if (!baselineDraft) {
      return
    }

    setSaveError(null)
    setSaveSuccessMessage(null)
    setDraftOverride(baselineDraft)
  }

  async function handleDeleteProject() {
    try {
      setDeleteError(null)
      await deleteMutation.mutateAsync({ projectId })
      onClose?.()
      router.replace("/")
    } catch (error) {
      setDeleteError(getProjectActionError(error))
    }
  }

  const summary = draft

  return (
    <div className={shellClassName}>
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold">Project Settings</h1>
            <span className="text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[11px]">
              {projectId}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Define project-level defaults for executor selection, execution mode, and retention policies.
          </p>
        </div>

        {onClose ? (
          <Button type="button" variant="outline" size="icon" onClick={onClose}>
            <XIcon className="size-4" />
            <span className="sr-only">Close settings</span>
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid min-h-full gap-4 p-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="grid content-start gap-4">
            <Card className="p-4">
              <p className="text-sm font-semibold">Settings Scope</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                New tasks inherit the default executor and execution mode from here unless they are explicitly overridden at creation time.
              </p>

              <Separator className="my-4" />

              {summary ? (
                <dl className="grid gap-3 text-sm">
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground text-xs">Default Executor</dt>
                    <dd className="font-medium">{summary.defaultExecutor}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground text-xs">Execution Mode</dt>
                    <dd className="font-medium">
                      {formatExecutionModeLabel(summary.defaultExecutionMode)}
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground text-xs">Concurrency</dt>
                    <dd className="font-medium">{summary.maxConcurrentTasks}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground text-xs">Log Retention</dt>
                    <dd className="font-medium">
                      {summary.logRetentionDays
                        ? `${summary.logRetentionDays} days`
                        : "Disabled"}
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground text-xs">Event Retention</dt>
                    <dd className="font-medium">
                      {summary.eventRetentionDays
                        ? `${summary.eventRetentionDays} days`
                        : "Disabled"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <div className="grid gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-36" />
                </div>
              )}
            </Card>

            <Card className="p-4">
              <p className="text-sm font-semibold">Runtime Strategy</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                The current default uses a pre-authorized runtime flow instead of in-run approval as the primary path. These values are the project-level baseline.
              </p>
            </Card>

            <Card className="border-red-200 p-4">
              <p className="text-sm font-semibold">Danger Zone</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Permanently delete this project record. This removes Harbor metadata for the project but does not delete files from the local workspace.
              </p>

              <div className="mt-4 grid gap-2">
                {confirmDelete ? (
                  <>
                    <p className="text-sm font-medium text-red-700">
                      Delete project permanently?
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void handleDeleteProject()}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? "Deleting..." : "Delete Project"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setConfirmDelete(false)
                          setDeleteError(null)
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => {
                      setDeleteError(null)
                      setConfirmDelete(true)
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    Delete Project
                  </Button>
                )}

                {deleteError ? (
                  <p className="text-xs text-red-600">{deleteError}</p>
                ) : null}
              </div>
            </Card>
          </aside>

          <Card className="min-h-0 p-4">
            {settingsQuery.isLoading && !draft ? (
              <div className="grid gap-4">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : settingsQuery.isError && !draft ? (
              <div className="grid gap-2">
                <p className="text-sm font-medium">Failed to load settings</p>
                <p className="text-muted-foreground text-sm">
                  {getProjectActionError(settingsQuery.error)}
                </p>
              </div>
            ) : draft ? (
              <Tabs defaultValue="general" className="flex h-full min-h-0 flex-col gap-4">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="execution">Execution</TabsTrigger>
                  <TabsTrigger value="retention">Retention</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-0 flex-1 space-y-4">
                  <div className="grid gap-2">
                    <p className="text-sm font-medium">Default Executor</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {EXECUTOR_OPTIONS.map((option) => {
                        const isActive = draft.defaultExecutor === option.value

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setSaveError(null)
                              setSaveSuccessMessage(null)
                              setDraftOverride((current) =>
                                current
                                  ? { ...current, defaultExecutor: option.value }
                                  : baselineDraft
                                    ? { ...baselineDraft, defaultExecutor: option.value }
                                    : current,
                              )
                            }}
                            disabled={updateMutation.isPending}
                            className={[
                              "rounded-xl border px-3 py-3 text-left transition-colors",
                              isActive
                                ? "border-primary bg-primary/5"
                                : "hover:border-muted-foreground/40",
                            ].join(" ")}
                          >
                            <p className="text-sm font-medium">{option.label}</p>
                            <p className="text-muted-foreground pt-1 text-xs">
                              {option.description}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                </TabsContent>

                <TabsContent value="execution" className="mt-0 flex-1 space-y-4">
                  <div className="grid gap-2">
                    <p className="text-sm font-medium">Default Execution Mode</p>
                    <div className="grid gap-2">
                      {EXECUTION_MODE_OPTIONS.map((option) => {
                        const isActive = draft.defaultExecutionMode === option.value

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setSaveError(null)
                              setSaveSuccessMessage(null)
                              setDraftOverride((current) =>
                                current
                                  ? {
                                      ...current,
                                      defaultExecutionMode: option.value,
                                    }
                                  : baselineDraft
                                    ? {
                                        ...baselineDraft,
                                        defaultExecutionMode: option.value,
                                      }
                                    : current,
                              )
                            }}
                            disabled={updateMutation.isPending}
                            className={[
                              "rounded-xl border px-3 py-3 text-left transition-colors",
                              isActive
                                ? "border-primary bg-primary/5"
                                : "hover:border-muted-foreground/40",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium">{option.label}</p>
                              <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
                                {option.label}
                              </span>
                            </div>
                            <p className="text-muted-foreground pt-1 text-xs">
                              {option.description}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <SettingsField
                    label="Max Concurrent Tasks"
                    description="Limit how many tasks can run concurrently for the current project."
                    value={draft.maxConcurrentTasks}
                    onChange={(value) => {
                      setSaveError(null)
                      setSaveSuccessMessage(null)
                      setDraftOverride((current) =>
                        current
                          ? { ...current, maxConcurrentTasks: value }
                          : baselineDraft
                            ? { ...baselineDraft, maxConcurrentTasks: value }
                            : current,
                      )
                    }}
                    type="number"
                    placeholder="1"
                  />
                </TabsContent>

                <TabsContent value="retention" className="mt-0 flex-1 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <SettingsField
                      label="Log Retention Days"
                      description="How many days to retain aggregated stdout and stderr content. Leave empty for no limit."
                      value={draft.logRetentionDays}
                      onChange={(value) => {
                        setSaveError(null)
                        setSaveSuccessMessage(null)
                        setDraftOverride((current) =>
                          current
                            ? { ...current, logRetentionDays: value }
                            : baselineDraft
                              ? { ...baselineDraft, logRetentionDays: value }
                              : current,
                        )
                      }}
                      type="number"
                      placeholder="30"
                    />
                    <SettingsField
                      label="Event Retention Days"
                      description="How many days to retain agent events. Leave empty for no limit."
                      value={draft.eventRetentionDays}
                      onChange={(value) => {
                        setSaveError(null)
                        setSaveSuccessMessage(null)
                        setDraftOverride((current) =>
                          current
                            ? { ...current, eventRetentionDays: value }
                            : baselineDraft
                              ? { ...baselineDraft, eventRetentionDays: value }
                              : current,
                        )
                      }}
                      type="number"
                      placeholder="7"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            ) : null}
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-between border-t px-5 py-3">
        <div className="grid gap-1">
          <p className="text-muted-foreground text-xs">
            {hasChanges ? "You have unsaved changes." : "Settings are synced with the backend."}
          </p>
          {saveError ? (
            <p className="text-xs text-red-600">{saveError}</p>
          ) : saveSuccessMessage ? (
            <p className="text-xs text-emerald-600">{saveSuccessMessage}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={!hasChanges || updateMutation.isPending}
          >
            <RotateCcwIcon className="size-4" />
            Reset
          </Button>

          {onClose ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : null}

          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!draft || !hasChanges || updateMutation.isPending}
          >
            <SaveIcon className="size-4" />
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
