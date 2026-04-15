"use client"

import { useLocation, useNavigate } from "@tanstack/react-router"
import { RotateCcwIcon, SaveIcon, XIcon } from "lucide-react"
import { useEffect, useMemo, useState, type ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { parseNullablePositiveInteger } from "@/lib/utils"
import {
  getProjectActionError,
  type GitHubInstallation,
  type GitHubRepository,
  ProjectApiClientError,
  type ProjectRepositoryBinding,
  type ProjectSettings,
  useBindProjectRepositoryMutation,
  useGitHubInstallationRepositoriesQuery,
  useGitHubInstallationsQuery,
  useDeleteProjectMutation,
  useGitHubInstallUrlQuery,
  useProjectQuery,
  useProjectRepositoryBindingQuery,
  useProvisionProjectWorkspaceMutation,
  useProjectSettingsQuery,
  useSyncProjectWorkspaceMutation,
  useUpdateProjectSettingsMutation,
} from "@/modules/projects"
import {
  formatGitHubAppInstallEventMessage,
  subscribeToGitHubAppInstallEvents,
} from "@/modules/projects/lib/github-app-install-events"

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

function selectionButtonClassName(selected: boolean) {
  return cn(
    "grid w-full gap-1 rounded-md border px-3 py-3 text-left transition-colors",
    selected
      ? "border-foreground/30 bg-accent"
      : "border-border hover:bg-accent/60",
  )
}

function GitHubInstallationList(props: {
  installations: GitHubInstallation[]
  selectedInstallationId: string | null
  disabled?: boolean
  onSelect: (installationId: string) => void
}) {
  return (
    <div className="grid gap-2">
      {props.installations.map((installation) => {
        const selected = installation.id === props.selectedInstallationId

        return (
          <button
            key={installation.id}
            type="button"
            className={selectionButtonClassName(selected)}
            onClick={() => props.onSelect(installation.id)}
            disabled={props.disabled}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">
                {installation.accountLogin}
              </span>
              <span className="text-muted-foreground text-xs capitalize">
                {installation.accountType}
              </span>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
              <span>Repository scope: {installation.targetType}</span>
              <span>Status: {installation.status}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function GitHubRepositoryList(props: {
  repositories: GitHubRepository[]
  selectedRepositoryFullName: string | null
  disabled?: boolean
  onSelect: (repository: GitHubRepository) => void
}) {
  return (
    <div className="grid gap-2">
      {props.repositories.map((repository) => {
        const selected =
          repository.fullName === props.selectedRepositoryFullName

        return (
          <button
            key={repository.nodeId}
            type="button"
            className={selectionButtonClassName(selected)}
            onClick={() => props.onSelect(repository)}
            disabled={props.disabled}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{repository.fullName}</span>
              <span className="text-muted-foreground text-xs capitalize">
                {repository.visibility ?? "unknown"}
              </span>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
              <span>{repository.url}</span>
              <span>
                Default branch: {repository.defaultBranch ?? "Not reported"}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function RepositoryBindingSummary(props: {
  binding: ProjectRepositoryBinding
  workspacePath: string | null
}) {
  return (
    <dl className="grid gap-3 text-sm">
      <div className="grid gap-1">
        <dt className="text-muted-foreground text-xs">Provider</dt>
        <dd className="font-medium">GitHub</dd>
      </div>
      <div className="grid gap-1">
        <dt className="text-muted-foreground text-xs">Installation</dt>
        <dd className="font-medium">{props.binding.repositoryOwner}</dd>
      </div>
      <div className="grid gap-1">
        <dt className="text-muted-foreground text-xs">Repository</dt>
        <dd className="font-medium">{props.binding.repositoryFullName}</dd>
      </div>
      <div className="grid gap-1">
        <dt className="text-muted-foreground text-xs">Branch</dt>
        <dd className="font-medium">
          {props.binding.defaultBranch ?? "Not reported"}
        </dd>
      </div>
      <div className="grid gap-1">
        <dt className="text-muted-foreground text-xs">Workspace State</dt>
        <dd className="font-medium capitalize">
          {props.binding.workspaceState}
        </dd>
      </div>
      {props.workspacePath ? (
        <div className="grid gap-1">
          <dt className="text-muted-foreground text-xs">Workspace Path</dt>
          <dd className="font-medium break-all">{props.workspacePath}</dd>
        </div>
      ) : null}
    </dl>
  )
}

export function ProjectSettingsView({
  projectId,
  mode = "page",
  onClose,
}: ProjectSettingsViewProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const projectQuery = useProjectQuery(projectId)
  const settingsQuery = useProjectSettingsQuery(projectId)
  const repositoryBindingQuery = useProjectRepositoryBindingQuery(
    projectId,
    projectQuery.data?.source.type === "git",
  )
  const returnTo = location.href
  const installUrlQuery = useGitHubInstallUrlQuery(
    returnTo,
    projectQuery.data?.source.type === "git",
  )
  const installationsQuery = useGitHubInstallationsQuery(
    projectQuery.data?.source.type === "git",
  )
  const bindRepositoryMutation = useBindProjectRepositoryMutation(projectId)
  const updateMutation = useUpdateProjectSettingsMutation(projectId)
  const provisionMutation = useProvisionProjectWorkspaceMutation()
  const syncMutation = useSyncProjectWorkspaceMutation()
  const deleteMutation = useDeleteProjectMutation()
  const [draftOverride, setDraftOverride] = useState<SettingsDraft | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(
    null,
  )
  const [repositoryActionError, setRepositoryActionError] = useState<
    string | null
  >(null)
  const [repositoryActionSuccess, setRepositoryActionSuccess] = useState<
    string | null
  >(null)
  const [selectedInstallationId, setSelectedInstallationId] = useState<
    string | null
  >(null)
  const [selectedRepositoryFullName, setSelectedRepositoryFullName] = useState<
    string | null
  >(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const repositoriesQuery = useGitHubInstallationRepositoriesQuery(
    selectedInstallationId,
  )

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
          logRetentionDays: parseNullablePositiveInteger(
            draft.logRetentionDays,
          ),
          eventRetentionDays: parseNullablePositiveInteger(
            draft.eventRetentionDays,
          ),
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
  const project = projectQuery.data ?? null
  const repositoryBinding = repositoryBindingQuery.data ?? null
  const bindingMissing =
    repositoryBindingQuery.error instanceof ProjectApiClientError &&
    repositoryBindingQuery.error.code === "NOT_FOUND"
  const repositoryActionPending =
    provisionMutation.isPending ||
    syncMutation.isPending ||
    bindRepositoryMutation.isPending
  const selectedRepository = useMemo(
    () =>
      repositoriesQuery.data?.find(
        (repository) => repository.fullName === selectedRepositoryFullName,
      ) ?? null,
    [repositoriesQuery.data, selectedRepositoryFullName],
  )

  useEffect(() => {
    if (!bindingMissing) {
      return
    }

    if (!installationsQuery.data?.length) {
      setSelectedInstallationId(null)
      return
    }

    const stillPresent = installationsQuery.data.some(
      (installation) => installation.id === selectedInstallationId,
    )
    if (!stillPresent) {
      setSelectedInstallationId(installationsQuery.data[0]?.id ?? null)
    }
  }, [bindingMissing, installationsQuery.data, selectedInstallationId])

  useEffect(() => {
    if (!bindingMissing) {
      return
    }

    if (!repositoriesQuery.data?.length) {
      setSelectedRepositoryFullName(null)
      return
    }

    const nextSelection =
      repositoriesQuery.data.find(
        (repository) => repository.fullName === selectedRepositoryFullName,
      ) ?? repositoriesQuery.data[0]

    if (!nextSelection) {
      return
    }

    setSelectedRepositoryFullName(nextSelection.fullName)
  }, [bindingMissing, repositoriesQuery.data, selectedRepositoryFullName])

  useEffect(
    () =>
      subscribeToGitHubAppInstallEvents((event) => {
        if (event.returnTo && event.returnTo !== returnTo) {
          return
        }

        if (event.status === "success") {
          setRepositoryActionError(null)
          setRepositoryActionSuccess(formatGitHubAppInstallEventMessage(event))
          void installUrlQuery.refetch()
          void installationsQuery.refetch()
          if (selectedInstallationId) {
            void repositoriesQuery.refetch()
          }
          return
        }

        setRepositoryActionSuccess(null)
        setRepositoryActionError(formatGitHubAppInstallEventMessage(event))
      }),
    [
      installUrlQuery,
      installationsQuery,
      repositoriesQuery,
      returnTo,
      selectedInstallationId,
    ],
  )

  async function handleProvisionWorkspace() {
    try {
      setRepositoryActionError(null)
      const result = await provisionMutation.mutateAsync({ projectId })
      setRepositoryActionSuccess(
        `Workspace provisioned at ${result.project.rootPath ?? "the managed project path"}.`,
      )
    } catch (error) {
      setRepositoryActionSuccess(null)
      setRepositoryActionError(getProjectActionError(error))
    }
  }

  async function handleSyncWorkspace() {
    try {
      setRepositoryActionError(null)
      const result = await syncMutation.mutateAsync({ projectId })
      setRepositoryActionSuccess(`Repository synced at ${result.syncedAt}.`)
    } catch (error) {
      setRepositoryActionSuccess(null)
      setRepositoryActionError(getProjectActionError(error))
    }
  }

  async function openGitHubInstallUrl() {
    try {
      setRepositoryActionError(null)
      setRepositoryActionSuccess(null)
      const result = await installUrlQuery.refetch()
      if (!result.data) {
        return
      }

      window.open(result.data, "_blank", "noopener,noreferrer")
    } catch (error) {
      setRepositoryActionError(getProjectActionError(error))
    }
  }

  async function handleBindRepository() {
    if (!selectedInstallationId || !selectedRepository) {
      setRepositoryActionSuccess(null)
      setRepositoryActionError(
        "Select a GitHub installation and repository first.",
      )
      return
    }

    try {
      setRepositoryActionError(null)
      setRepositoryActionSuccess(null)
      const binding = await bindRepositoryMutation.mutateAsync({
        repositoryBinding: {
          provider: "github",
          installationId: selectedInstallationId,
          repositoryFullName: selectedRepository.fullName,
        },
      })
      setRepositoryActionSuccess(
        `Repository access connected for ${binding.repositoryFullName}.`,
      )
    } catch (error) {
      setRepositoryActionSuccess(null)
      setRepositoryActionError(getProjectActionError(error))
    }
  }

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
            Manage repository access and project-level retention policies for
            Harbor task data.
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
                New tasks inherit the default executor and execution mode from
                here unless they are explicitly overridden at creation time.
              </p>

              <Separator className="my-4" />

              {summary ? (
                <dl className="grid gap-3 text-sm">
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground text-xs">
                      Log Retention
                    </dt>
                    <dd className="font-medium">
                      {summary.logRetentionDays
                        ? `${summary.logRetentionDays} days`
                        : "Disabled"}
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground text-xs">
                      Event Retention
                    </dt>
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
                These values control how long Harbor keeps task logs and task
                events for this project.
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Repository Access</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    Manage GitHub App access, repository binding, and workspace
                    lifecycle.
                  </p>
                </div>
                {project?.source.type === "git" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRepositoryActionError(null)
                      setRepositoryActionSuccess(null)
                      void installUrlQuery.refetch()
                      void installationsQuery.refetch()
                      if (selectedInstallationId) {
                        void repositoriesQuery.refetch()
                      }
                      void repositoryBindingQuery.refetch()
                      void projectQuery.refetch()
                    }}
                    disabled={repositoryActionPending}
                  >
                    Refresh
                  </Button>
                ) : null}
              </div>

              <Separator className="my-4" />

              {projectQuery.isLoading && !project ? (
                <div className="grid gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ) : projectQuery.isError && !project ? (
                <p className="text-sm text-red-600">
                  {getProjectActionError(projectQuery.error)}
                </p>
              ) : project?.source.type === "rootPath" ? (
                <p className="text-muted-foreground text-sm leading-6">
                  This project is backed by a server-local path and does not use
                  GitHub App repository access.
                </p>
              ) : repositoryBinding ? (
                <div className="grid gap-4">
                  <RepositoryBindingSummary
                    binding={repositoryBinding}
                    workspacePath={project?.rootPath ?? null}
                  />

                  <div className="grid gap-2">
                    {repositoryActionError ? (
                      <p className="text-xs text-red-600">
                        {repositoryActionError}
                      </p>
                    ) : repositoryActionSuccess ? (
                      <p className="text-xs text-emerald-600">
                        {repositoryActionSuccess}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {repositoryBinding.workspaceState === "unprovisioned" ? (
                      <Button
                        type="button"
                        onClick={() => void handleProvisionWorkspace()}
                        disabled={repositoryActionPending}
                      >
                        {provisionMutation.isPending
                          ? "Provisioning..."
                          : "Provision Workspace"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => void handleSyncWorkspace()}
                        disabled={repositoryActionPending}
                      >
                        {syncMutation.isPending
                          ? "Syncing..."
                          : "Sync Repository"}
                      </Button>
                    )}

                    <Button variant="outline" type="button" asChild>
                      <a
                        href={repositoryBinding.repositoryUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View on GitHub
                      </a>
                    </Button>
                  </div>
                </div>
              ) : bindingMissing ? (
                <div className="grid gap-4">
                  <p className="text-muted-foreground text-sm leading-6">
                    This git project does not have a GitHub repository binding
                    yet. Install the GitHub App if needed, then select an
                    installation and repository to connect access.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void openGitHubInstallUrl()}
                      disabled={
                        installUrlQuery.isFetching || repositoryActionPending
                      }
                    >
                      Install GitHub App
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        void installUrlQuery.refetch()
                        void installationsQuery.refetch()
                        if (selectedInstallationId) {
                          void repositoriesQuery.refetch()
                        }
                        void repositoryBindingQuery.refetch()
                      }}
                      disabled={repositoryActionPending}
                    >
                      Refresh Access
                    </Button>
                  </div>

                  {repositoryActionError ? (
                    <p className="text-xs text-red-600">
                      {repositoryActionError}
                    </p>
                  ) : repositoryActionSuccess ? (
                    <p className="text-xs text-emerald-600">
                      {repositoryActionSuccess}
                    </p>
                  ) : null}
                  {installUrlQuery.error ? (
                    <p className="text-xs text-red-600">
                      {getProjectActionError(installUrlQuery.error)}
                    </p>
                  ) : null}

                  <div className="grid gap-2">
                    <p className="text-sm font-medium">
                      1. Choose Installation
                    </p>
                    {installationsQuery.isLoading ? (
                      <p className="text-muted-foreground text-sm">
                        Loading GitHub installations...
                      </p>
                    ) : installationsQuery.isError ? (
                      <p className="text-sm text-red-600">
                        {getProjectActionError(installationsQuery.error)}
                      </p>
                    ) : installationsQuery.data?.length ? (
                      <GitHubInstallationList
                        installations={installationsQuery.data}
                        selectedInstallationId={selectedInstallationId}
                        disabled={repositoryActionPending}
                        onSelect={(installationId) => {
                          setRepositoryActionError(null)
                          setRepositoryActionSuccess(null)
                          setSelectedInstallationId(installationId)
                          setSelectedRepositoryFullName(null)
                        }}
                      />
                    ) : (
                      <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                        No GitHub App installations are connected yet. Install
                        the GitHub App and then refresh this list.
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <p className="text-sm font-medium">2. Choose Repository</p>
                    {!selectedInstallationId ? (
                      <p className="text-muted-foreground text-sm">
                        Select an installation to load its repositories.
                      </p>
                    ) : repositoriesQuery.isLoading ? (
                      <p className="text-muted-foreground text-sm">
                        Loading repositories for this installation...
                      </p>
                    ) : repositoriesQuery.isError ? (
                      <p className="text-sm text-red-600">
                        {getProjectActionError(repositoriesQuery.error)}
                      </p>
                    ) : repositoriesQuery.data?.length ? (
                      <GitHubRepositoryList
                        repositories={repositoriesQuery.data}
                        selectedRepositoryFullName={selectedRepositoryFullName}
                        disabled={repositoryActionPending}
                        onSelect={(repository) => {
                          setRepositoryActionError(null)
                          setRepositoryActionSuccess(null)
                          setSelectedRepositoryFullName(repository.fullName)
                        }}
                      />
                    ) : (
                      <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                        Harbor can see this installation, but no repositories
                        are currently in scope.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void handleBindRepository()}
                      disabled={repositoryActionPending || !selectedRepository}
                    >
                      {bindRepositoryMutation.isPending
                        ? "Connecting..."
                        : "Connect Repository Access"}
                    </Button>
                  </div>
                </div>
              ) : repositoryBindingQuery.isLoading ? (
                <div className="grid gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ) : repositoryBindingQuery.isError ? (
                <p className="text-sm text-red-600">
                  {getProjectActionError(repositoryBindingQuery.error)}
                </p>
              ) : null}
            </Card>

            <Card className="border-red-200 p-4">
              <p className="text-sm font-semibold">Danger Zone</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Permanently delete this project record. This removes Harbor
                metadata for the project but does not delete files from the
                local workspace.
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
                        {deleteMutation.isPending
                          ? "Deleting..."
                          : "Delete Project"}
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
            {hasChanges
              ? "You have unsaved changes."
              : "Settings are synced with the backend."}
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
