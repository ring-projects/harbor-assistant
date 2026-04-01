"use client"

import { useNavigate } from "@tanstack/react-router"
import { RotateCcwIcon, SaveIcon, XIcon } from "lucide-react"
import { useMemo, useState, type ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { parseNullablePositiveInteger } from "@/lib/utils"
import {
  getProjectActionError,
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
  logRetentionDays: string
  eventRetentionDays: string
}

function toDraft(settings: ProjectSettings): SettingsDraft {
  return {
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
  const navigate = useNavigate()
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
      void navigate({
        to: "/",
        replace: true,
      })
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
            Manage project-level retention policies for Harbor task data.
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
              <p className="text-sm font-semibold">Retention Policy</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                These values control how long Harbor keeps task logs and task events for this project.
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
              <div className="grid gap-4">
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
              </div>
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
