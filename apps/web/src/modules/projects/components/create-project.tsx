"use client"

import { useLocation } from "@tanstack/react-router"
import { useEffect, useMemo, useState, type FormEvent } from "react"

import { DirectoryPicker } from "@/components/directory-picker"
import { statBootstrapDirectorySelection } from "@/components/directory-picker/directory-picker-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  getProjectActionError,
  useCreateProjectMutation,
  useGitHubInstallationRepositoriesQuery,
  useGitHubInstallationsQuery,
  useGitHubInstallUrlQuery,
  useProvisionProjectWorkspaceMutation,
} from "@/modules/projects/hooks"
import {
  formatGitHubAppInstallEventMessage,
  subscribeToGitHubAppInstallEvents,
} from "@/modules/projects/lib/github-app-install-events"
import type {
  GitHubInstallation,
  GitHubRepository,
  Project,
} from "@/modules/projects/types"

type CreateProjectProps = {
  className?: string
  appearance?: "default" | "landing"
  workspaceId?: string | null
  submitLabel?: string
  cancelLabel?: string
  pickerTitle?: string | null
  defaultPath?: string
  defaultName?: string
  onCancel?: () => void
  onCreated?: (project: Project) => void
}

type CreateSourceMode = "rootPath" | "github" | "manualGit"

function deriveProjectName(name: string, fallback: string) {
  const trimmedName = name.trim()
  if (trimmedName) {
    return trimmedName
  }

  return fallback
}

function deriveNameFromPath(rootPath: string) {
  return rootPath.split(/[\\/]/).filter(Boolean).at(-1) || rootPath
}

function deriveNameFromRepositoryUrl(repositoryUrl: string) {
  const normalizedUrl = repositoryUrl.trim().replace(/\/+$/, "")
  const segment = normalizedUrl.split("/").at(-1) ?? normalizedUrl
  return segment.replace(/\.git$/i, "") || normalizedUrl
}

function selectionButtonClassName(
  selected: boolean,
  appearance: CreateProjectProps["appearance"] = "default",
) {
  if (appearance === "landing") {
    return cn(
      "grid w-full gap-1 rounded-[4px] border px-4 py-4 text-left transition-colors",
      selected
        ? "border-[#201d1d] bg-[#201d1d] text-[#fdfcfc]"
        : "border-[rgba(15,0,0,0.12)] bg-[#f8f7f7] text-[#201d1d] hover:bg-white",
    )
  }

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
  appearance?: CreateProjectProps["appearance"]
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
            className={selectionButtonClassName(selected, props.appearance)}
            onClick={() => props.onSelect(installation.id)}
            disabled={props.disabled}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">
                {installation.accountLogin}
              </span>
              <span
                className={cn(
                  "text-xs capitalize",
                  selected ? "text-[#d6d2d2]" : "text-[#6e6e73]",
                )}
              >
                {installation.accountType}
              </span>
            </div>
            <div
              className={cn(
                "flex items-center justify-between gap-3 text-xs",
                selected ? "text-[#d6d2d2]" : "text-[#6e6e73]",
              )}
            >
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
  appearance?: CreateProjectProps["appearance"]
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
            className={selectionButtonClassName(selected, props.appearance)}
            onClick={() => props.onSelect(repository)}
            disabled={props.disabled}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{repository.fullName}</span>
              <span
                className={cn(
                  "text-xs capitalize",
                  selected ? "text-[#d6d2d2]" : "text-[#6e6e73]",
                )}
              >
                {repository.visibility ?? "unknown"}
              </span>
            </div>
            <div
              className={cn(
                "flex items-center justify-between gap-3 text-xs",
                selected ? "text-[#d6d2d2]" : "text-[#6e6e73]",
              )}
            >
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

export function CreateProject(props: CreateProjectProps) {
  const {
    className,
    appearance = "default",
    workspaceId = null,
    submitLabel = "Create Project",
    cancelLabel = "Cancel",
    pickerTitle = "Project Source",
    onCreated,
  } = props
  const location = useLocation()
  const [mode, setMode] = useState<CreateSourceMode>("rootPath")
  const [name, setName] = useState(props.defaultName ?? "")
  const [manualRepositoryUrl, setManualRepositoryUrl] = useState("")
  const [manualBranch, setManualBranch] = useState("")
  const [githubBranch, setGitHubBranch] = useState("")
  const [selectedInstallationId, setSelectedInstallationId] = useState<
    string | null
  >(null)
  const [selectedRepositoryFullName, setSelectedRepositoryFullName] = useState<
    string | null
  >(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [githubAppFeedback, setGitHubAppFeedback] = useState<string | null>(
    null,
  )
  const [createdProjectPendingProvision, setCreatedProjectPendingProvision] =
    useState<Project | null>(null)
  const createMutation = useCreateProjectMutation()
  const provisionMutation = useProvisionProjectWorkspaceMutation()
  const returnTo = location.href
  const installUrlQuery = useGitHubInstallUrlQuery(
    returnTo,
    workspaceId,
    mode === "github",
  )
  const installationsQuery = useGitHubInstallationsQuery(
    workspaceId,
    mode === "github",
  )
  const repositoriesQuery = useGitHubInstallationRepositoriesQuery(
    mode === "github" ? selectedInstallationId : null,
    workspaceId,
  )

  const selectedRepository = useMemo(
    () =>
      repositoriesQuery.data?.find(
        (repository) => repository.fullName === selectedRepositoryFullName,
      ) ?? null,
    [repositoriesQuery.data, selectedRepositoryFullName],
  )

  useEffect(() => {
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
  }, [installationsQuery.data, selectedInstallationId])

  useEffect(() => {
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
    setGitHubBranch((current) => {
      if (!current) {
        return nextSelection.defaultBranch ?? ""
      }

      return current
    })
  }, [repositoriesQuery.data, selectedRepositoryFullName])

  useEffect(
    () =>
      subscribeToGitHubAppInstallEvents((event) => {
        if (event.returnTo && event.returnTo !== returnTo) {
          return
        }

        setCreatedProjectPendingProvision(null)

        if (event.status === "success") {
          setFormError(null)
          setGitHubAppFeedback(formatGitHubAppInstallEventMessage(event))
          void installUrlQuery.refetch()
          void installationsQuery.refetch()
          if (selectedInstallationId) {
            void repositoriesQuery.refetch()
          }
          return
        }

        setGitHubAppFeedback(null)
        setFormError(formatGitHubAppInstallEventMessage(event))
      }),
    [
      installUrlQuery,
      installationsQuery,
      repositoriesQuery,
      returnTo,
      selectedInstallationId,
    ],
  )

  function clearFeedback() {
    setFormError(null)
    setGitHubAppFeedback(null)
    setCreatedProjectPendingProvision(null)
  }

  function handleModeChange(value: string) {
    clearFeedback()
    setMode(value as CreateSourceMode)
  }

  async function handleRootPathConfirm(selection: {
    rootId: string
    rootPath: string
    path: string
  }) {
    try {
      clearFeedback()
      const pathInfo = await statBootstrapDirectorySelection(selection)
      const project = await createMutation.mutateAsync({
        workspaceId,
        name: deriveProjectName(
          name,
          deriveNameFromPath(pathInfo.absolutePath),
        ),
        source: {
          type: "rootPath",
          rootPath: pathInfo.absolutePath,
        },
      })

      onCreated?.(project)
    } catch (error) {
      setFormError(getProjectActionError(error))
    }
  }

  async function handleManualGitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      clearFeedback()
      const trimmedRepositoryUrl = manualRepositoryUrl.trim()
      const project = await createMutation.mutateAsync({
        workspaceId,
        name: deriveProjectName(
          name,
          deriveNameFromRepositoryUrl(trimmedRepositoryUrl),
        ),
        source: {
          type: "git",
          repositoryUrl: trimmedRepositoryUrl,
          branch: manualBranch.trim() || null,
        },
      })

      onCreated?.(project)
    } catch (error) {
      setFormError(getProjectActionError(error))
    }
  }

  async function handleGitHubCreate(provisionWorkspaceImmediately: boolean) {
    if (!selectedInstallationId || !selectedRepository) {
      setFormError("Select a GitHub installation and repository first.")
      return
    }

    try {
      clearFeedback()
      const project = await createMutation.mutateAsync({
        workspaceId,
        name: deriveProjectName(name, selectedRepository.name),
        source: {
          type: "git",
          repositoryUrl: selectedRepository.url,
          branch:
            githubBranch.trim() || selectedRepository.defaultBranch || null,
        },
        repositoryBinding: {
          provider: "github",
          installationId: selectedInstallationId,
          repositoryFullName: selectedRepository.fullName,
        },
      })

      if (!provisionWorkspaceImmediately) {
        onCreated?.(project)
        return
      }

      try {
        const result = await provisionMutation.mutateAsync({
          projectId: project.id,
        })

        onCreated?.(result.project)
      } catch (error) {
        setCreatedProjectPendingProvision(project)
        setFormError(
          `Project created, but workspace provisioning failed. ${getProjectActionError(error)}`,
        )
      }
    } catch (error) {
      setFormError(getProjectActionError(error))
    }
  }

  async function openGitHubInstallUrl() {
    try {
      clearFeedback()
      const result = await installUrlQuery.refetch()
      if (!result.data) {
        return
      }

      window.open(result.data, "_blank", "noopener,noreferrer")
    } catch (error) {
      setFormError(getProjectActionError(error))
    }
  }

  const isMutating = createMutation.isPending || provisionMutation.isPending
  const isLandingAppearance = appearance === "landing"
  const inputClassName = isLandingAppearance
    ? "h-auto rounded-[6px] border-[rgba(15,0,0,0.12)] bg-[#f8f7f7] px-5 py-5 text-base text-[#201d1d] placeholder:text-[#6e6e73] shadow-none focus-visible:border-[#646262] focus-visible:ring-0"
    : undefined
  const containerClassName = isLandingAppearance ? "grid gap-6" : "grid gap-5 p-5"
  const panelClassName = isLandingAppearance
    ? "grid gap-5 rounded-[4px] border border-[rgba(15,0,0,0.12)] bg-white p-5"
    : "grid gap-4 rounded-lg border p-4"
  const secondaryButtonClassName = isLandingAppearance
    ? "rounded-[4px] border-[rgba(15,0,0,0.12)] bg-transparent text-[#201d1d] shadow-none hover:bg-[#f1eeee] hover:text-[#201d1d]"
    : undefined
  const ghostButtonClassName = isLandingAppearance
    ? "rounded-[4px] text-[#201d1d] hover:bg-[#f1eeee] hover:text-[#201d1d]"
    : undefined
  const primaryButtonClassName = isLandingAppearance
    ? "rounded-[4px] border-[#201d1d] bg-[#201d1d] text-[#fdfcfc] shadow-none hover:bg-[#302c2c] hover:text-[#fdfcfc]"
    : undefined

  return (
    <div
      className={cn(
        containerClassName,
        isLandingAppearance && "text-[#201d1d]",
        className,
      )}
    >
      {pickerTitle ? (
        <div className="space-y-1">
          <h3
            className={cn(
              "font-semibold",
              isLandingAppearance ? "text-base leading-6" : "text-sm",
            )}
          >
            {pickerTitle}
          </h3>
          <p
            className={cn(
              isLandingAppearance
                ? "text-sm leading-6 text-[#6e6e73]"
                : "text-muted-foreground text-sm",
            )}
          >
            Create a project from a server-local workspace, a GitHub repository
            via GitHub App access, or a manual git URL.
          </p>
        </div>
      ) : null}

      <div className="grid gap-2">
        <label
          className={cn(
            "font-medium",
            isLandingAppearance ? "text-base leading-6" : "text-sm",
          )}
          htmlFor="project-name"
        >
          Name
        </label>
        <Input
          id="project-name"
          value={name}
          onChange={(event) => {
            clearFeedback()
            setName(event.target.value)
          }}
          placeholder="Optional. Defaults to the selected path or repository name."
          disabled={isMutating}
          className={inputClassName}
        />
        <p
          className={cn(
            isLandingAppearance
              ? "text-sm leading-6 text-[#6e6e73]"
              : "text-muted-foreground text-xs",
          )}
        >
          Leave this blank to derive the project name from the selected source.
        </p>
      </div>

      <Tabs
        value={mode}
        onValueChange={handleModeChange}
        className={cn("grid gap-4", isLandingAppearance && "gap-5")}
      >
        <TabsList
          variant={isLandingAppearance ? "line" : "default"}
          className={cn(
            isLandingAppearance
              ? "h-auto w-full justify-start gap-6 border-b border-[rgba(15,0,0,0.12)] p-0"
              : "grid w-full grid-cols-3",
          )}
        >
          <TabsTrigger
            value="rootPath"
            className={cn(
              isLandingAppearance &&
                "h-auto flex-none rounded-none border-0 border-b-2 border-transparent px-0 py-0 pb-3 text-[15px] font-medium leading-4 text-[#6e6e73] after:hidden data-[state=active]:border-[#9a9898] data-[state=active]:bg-transparent data-[state=active]:text-[#201d1d]",
            )}
          >
            Local Path
          </TabsTrigger>
          <TabsTrigger
            value="github"
            className={cn(
              isLandingAppearance &&
                "h-auto flex-none rounded-none border-0 border-b-2 border-transparent px-0 py-0 pb-3 text-[15px] font-medium leading-4 text-[#6e6e73] after:hidden data-[state=active]:border-[#9a9898] data-[state=active]:bg-transparent data-[state=active]:text-[#201d1d]",
            )}
          >
            GitHub
          </TabsTrigger>
          <TabsTrigger
            value="manualGit"
            className={cn(
              isLandingAppearance &&
                "h-auto flex-none rounded-none border-0 border-b-2 border-transparent px-0 py-0 pb-3 text-[15px] font-medium leading-4 text-[#6e6e73] after:hidden data-[state=active]:border-[#9a9898] data-[state=active]:bg-transparent data-[state=active]:text-[#201d1d]",
            )}
          >
            Manual URL
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="rootPath"
          className={cn("mt-0", isLandingAppearance && "pt-1")}
        >
          <DirectoryPicker
            className={cn(
              "border-border/70",
              isLandingAppearance &&
                "rounded-[4px] border-[rgba(15,0,0,0.12)] bg-white text-[#201d1d]",
            )}
            title={null}
            confirmLabel={isMutating ? "Creating..." : submitLabel}
            cancelLabel={cancelLabel}
            initialPath={props.defaultPath}
            disabled={isMutating}
            onConfirm={handleRootPathConfirm}
            onCancel={props.onCancel}
          />
        </TabsContent>

        <TabsContent
          value="github"
          className={cn("mt-0", isLandingAppearance && "pt-1")}
        >
          <div className={panelClassName}>
            <div className="space-y-1">
              <p
                className={cn(
                  "font-medium",
                  isLandingAppearance ? "text-base leading-6" : "text-sm",
                )}
              >
                GitHub Repository Access
              </p>
              <p
                className={cn(
                  isLandingAppearance
                    ? "text-sm leading-6 text-[#6e6e73]"
                    : "text-muted-foreground text-xs leading-5",
                )}
              >
                GitHub login identifies you. GitHub App installation grants
                Harbor access to selected repositories.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void openGitHubInstallUrl()}
                disabled={installUrlQuery.isFetching || isMutating}
                className={secondaryButtonClassName}
              >
                Install GitHub App
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  clearFeedback()
                  void installUrlQuery.refetch()
                  void installationsQuery.refetch()
                  if (selectedInstallationId) {
                    void repositoriesQuery.refetch()
                  }
                }}
                disabled={isMutating}
                className={ghostButtonClassName}
              >
                Refresh Access
              </Button>
            </div>

            {installUrlQuery.isError ? (
              <p
                className={cn(
                  isLandingAppearance
                    ? "text-sm leading-6 text-[#ff3b30]"
                    : "text-xs text-red-600",
                )}
              >
                {getProjectActionError(installUrlQuery.error)}
              </p>
            ) : null}
            {githubAppFeedback ? (
              <p
                className={cn(
                  isLandingAppearance
                    ? "text-sm leading-6 text-[#30d158]"
                    : "text-xs text-emerald-600",
                )}
              >
                {githubAppFeedback}
              </p>
            ) : null}

            <div className="grid gap-2">
              <p
                className={cn(
                  "font-medium",
                  isLandingAppearance ? "text-base leading-6" : "text-sm",
                )}
              >
                1. Choose Installation
              </p>
              {installationsQuery.isLoading ? (
                <p
                  className={cn(
                    isLandingAppearance
                      ? "text-sm leading-6 text-[#6e6e73]"
                      : "text-muted-foreground text-sm",
                  )}
                >
                  Loading GitHub installations...
                </p>
              ) : installationsQuery.isError ? (
                <p
                  className={cn(
                    isLandingAppearance
                      ? "text-sm leading-6 text-[#ff3b30]"
                      : "text-sm text-red-600",
                  )}
                >
                  {getProjectActionError(installationsQuery.error)}
                </p>
              ) : installationsQuery.data?.length ? (
                <GitHubInstallationList
                  installations={installationsQuery.data}
                  selectedInstallationId={selectedInstallationId}
                  appearance={appearance}
                  disabled={isMutating}
                  onSelect={(installationId) => {
                    clearFeedback()
                    setSelectedInstallationId(installationId)
                    setSelectedRepositoryFullName(null)
                    setGitHubBranch("")
                  }}
                />
              ) : (
                <div
                  className={cn(
                    isLandingAppearance
                      ? "rounded-[4px] border border-dashed border-[rgba(15,0,0,0.12)] p-4 text-sm leading-6 text-[#6e6e73]"
                      : "text-muted-foreground rounded-lg border border-dashed p-4 text-sm",
                  )}
                >
                  No GitHub App installations are connected yet. Install the
                  GitHub App and then refresh this list.
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <p
                className={cn(
                  "font-medium",
                  isLandingAppearance ? "text-base leading-6" : "text-sm",
                )}
              >
                2. Choose Repository
              </p>
              {!selectedInstallationId ? (
                <p
                  className={cn(
                    isLandingAppearance
                      ? "text-sm leading-6 text-[#6e6e73]"
                      : "text-muted-foreground text-sm",
                  )}
                >
                  Select an installation to load its repositories.
                </p>
              ) : repositoriesQuery.isLoading ? (
                <p
                  className={cn(
                    isLandingAppearance
                      ? "text-sm leading-6 text-[#6e6e73]"
                      : "text-muted-foreground text-sm",
                  )}
                >
                  Loading repositories for this installation...
                </p>
              ) : repositoriesQuery.isError ? (
                <p
                  className={cn(
                    isLandingAppearance
                      ? "text-sm leading-6 text-[#ff3b30]"
                      : "text-sm text-red-600",
                  )}
                >
                  {getProjectActionError(repositoriesQuery.error)}
                </p>
              ) : repositoriesQuery.data?.length ? (
                <GitHubRepositoryList
                  repositories={repositoriesQuery.data}
                  selectedRepositoryFullName={selectedRepositoryFullName}
                  appearance={appearance}
                  disabled={isMutating}
                  onSelect={(repository) => {
                    clearFeedback()
                    setSelectedRepositoryFullName(repository.fullName)
                    setGitHubBranch(repository.defaultBranch ?? "")
                  }}
                />
              ) : (
                <div
                  className={cn(
                    isLandingAppearance
                      ? "rounded-[4px] border border-dashed border-[rgba(15,0,0,0.12)] p-4 text-sm leading-6 text-[#6e6e73]"
                      : "text-muted-foreground rounded-lg border border-dashed p-4 text-sm",
                  )}
                >
                  Harbor can see this installation, but no repositories are
                  currently in scope.
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <label
                className={cn(
                  "font-medium",
                  isLandingAppearance ? "text-base leading-6" : "text-sm",
                )}
                htmlFor="project-github-branch"
              >
                Branch
              </label>
              <Input
                id="project-github-branch"
                value={githubBranch}
                onChange={(event) => {
                  clearFeedback()
                  setGitHubBranch(event.target.value)
                }}
                placeholder="Defaults to the repository default branch."
                disabled={isMutating || !selectedRepository}
                className={inputClassName}
              />
              <p
                className={cn(
                  isLandingAppearance
                    ? "text-sm leading-6 text-[#6e6e73]"
                    : "text-muted-foreground text-xs",
                )}
              >
                Harbor stores the repository binding first. You can provision
                the local workspace now or later.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {props.onCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={props.onCancel}
                  disabled={isMutating}
                  className={secondaryButtonClassName}
                >
                  {cancelLabel}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleGitHubCreate(false)}
                disabled={isMutating || !selectedRepository}
                className={secondaryButtonClassName}
              >
                Create Without Provisioning
              </Button>
              <Button
                type="button"
                onClick={() => void handleGitHubCreate(true)}
                disabled={isMutating || !selectedRepository}
                className={primaryButtonClassName}
              >
                {provisionMutation.isPending
                  ? "Provisioning..."
                  : createMutation.isPending
                    ? "Creating..."
                    : "Create and Provision Workspace"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value="manualGit"
          className={cn("mt-0", isLandingAppearance && "pt-1")}
        >
          <form
            className={panelClassName}
            onSubmit={handleManualGitSubmit}
          >
            <div className="grid gap-2">
              <label
                className={cn(
                  "font-medium",
                  isLandingAppearance ? "text-base leading-6" : "text-sm",
                )}
                htmlFor="project-repository-url"
              >
                Repository URL
              </label>
              <Input
                id="project-repository-url"
                value={manualRepositoryUrl}
                onChange={(event) => {
                  clearFeedback()
                  setManualRepositoryUrl(event.target.value)
                }}
                placeholder="https://github.com/acme/harbor-assistant.git"
                disabled={isMutating}
                required
                className={inputClassName}
              />
              <p
                className={cn(
                  isLandingAppearance
                    ? "text-sm leading-6 text-[#6e6e73]"
                    : "text-muted-foreground text-xs",
                )}
              >
                Use manual URL mode for public repositories or providers that
                are not connected through GitHub App access.
              </p>
            </div>

            <div className="grid gap-2">
              <label
                className={cn(
                  "font-medium",
                  isLandingAppearance ? "text-base leading-6" : "text-sm",
                )}
                htmlFor="project-repository-branch"
              >
                Default Branch
              </label>
              <Input
                id="project-repository-branch"
                value={manualBranch}
                onChange={(event) => {
                  clearFeedback()
                  setManualBranch(event.target.value)
                }}
                placeholder="Optional. For example: main"
                disabled={isMutating}
                className={inputClassName}
              />
            </div>

            <div className="flex justify-end gap-2">
              {props.onCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={props.onCancel}
                  disabled={isMutating}
                  className={secondaryButtonClassName}
                >
                  {cancelLabel}
                </Button>
              ) : null}
              <Button
                type="submit"
                disabled={isMutating}
                className={primaryButtonClassName}
              >
                {isMutating ? "Creating..." : submitLabel}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>

      {formError ? (
        <div
          className={cn(
            isLandingAppearance
              ? "grid gap-3 rounded-[4px] border border-[#ffb4ae] bg-[#fff5f5] p-4"
              : "grid gap-3 rounded-lg border border-red-200 bg-red-50/60 p-3",
          )}
        >
          <p
            className={cn(
              isLandingAppearance
                ? "text-sm leading-6 text-[#ff3b30]"
                : "text-sm text-red-700",
            )}
          >
            {formError}
          </p>
          {createdProjectPendingProvision ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onCreated?.(createdProjectPendingProvision)}
                className={secondaryButtonClassName}
              >
                Open Created Project
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
