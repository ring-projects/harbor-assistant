"use client"

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
import type {
  GitHubInstallation,
  GitHubRepository,
  Project,
} from "@/modules/projects/types"

type CreateProjectProps = {
  className?: string
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
              <span className="text-sm font-medium">{installation.accountLogin}</span>
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
        const selected = repository.fullName === props.selectedRepositoryFullName

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
              <span>Default branch: {repository.defaultBranch ?? "Not reported"}</span>
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
    submitLabel = "Create Project",
    cancelLabel = "Cancel",
    pickerTitle = "Project Source",
    onCreated,
  } = props
  const [mode, setMode] = useState<CreateSourceMode>("rootPath")
  const [name, setName] = useState(props.defaultName ?? "")
  const [manualRepositoryUrl, setManualRepositoryUrl] = useState("")
  const [manualBranch, setManualBranch] = useState("")
  const [githubBranch, setGitHubBranch] = useState("")
  const [selectedInstallationId, setSelectedInstallationId] = useState<string | null>(null)
  const [selectedRepositoryFullName, setSelectedRepositoryFullName] = useState<string | null>(
    null,
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [createdProjectPendingProvision, setCreatedProjectPendingProvision] =
    useState<Project | null>(null)
  const createMutation = useCreateProjectMutation()
  const provisionMutation = useProvisionProjectWorkspaceMutation()
  const installUrlQuery = useGitHubInstallUrlQuery(mode === "github")
  const installationsQuery = useGitHubInstallationsQuery(mode === "github")
  const repositoriesQuery = useGitHubInstallationRepositoriesQuery(
    mode === "github" ? selectedInstallationId : null,
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

  function clearFeedback() {
    setFormError(null)
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
        name: deriveProjectName(name, deriveNameFromPath(pathInfo.absolutePath)),
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
        name: deriveProjectName(name, deriveNameFromRepositoryUrl(trimmedRepositoryUrl)),
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
        name: deriveProjectName(name, selectedRepository.name),
        source: {
          type: "git",
          repositoryUrl: selectedRepository.url,
          branch: githubBranch.trim() || selectedRepository.defaultBranch || null,
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

  return (
    <div className={cn("grid gap-5 p-5", className)}>
      {pickerTitle ? (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{pickerTitle}</h3>
          <p className="text-muted-foreground text-sm">
            Create a project from a server-local workspace, a GitHub repository via
            GitHub App access, or a manual git URL.
          </p>
        </div>
      ) : null}

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="project-name">
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
        />
        <p className="text-muted-foreground text-xs">
          Leave this blank to derive the project name from the selected source.
        </p>
      </div>

      <Tabs value={mode} onValueChange={handleModeChange} className="grid gap-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rootPath">Local Path</TabsTrigger>
          <TabsTrigger value="github">GitHub</TabsTrigger>
          <TabsTrigger value="manualGit">Manual URL</TabsTrigger>
        </TabsList>

        <TabsContent value="rootPath" className="mt-0">
          <DirectoryPicker
            className="border-border/70"
            title={null}
            confirmLabel={isMutating ? "Creating..." : submitLabel}
            cancelLabel={cancelLabel}
            initialPath={props.defaultPath}
            disabled={isMutating}
            onConfirm={handleRootPathConfirm}
            onCancel={props.onCancel}
          />
        </TabsContent>

        <TabsContent value="github" className="mt-0">
          <div className="grid gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">GitHub Repository Access</p>
              <p className="text-muted-foreground text-xs leading-5">
                GitHub login identifies you. GitHub App installation grants Harbor
                access to selected repositories.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void openGitHubInstallUrl()}
                disabled={installUrlQuery.isFetching || isMutating}
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
              >
                Refresh Access
              </Button>
            </div>

            {installUrlQuery.isError ? (
              <p className="text-xs text-red-600">
                {getProjectActionError(installUrlQuery.error)}
              </p>
            ) : null}

            <div className="grid gap-2">
              <p className="text-sm font-medium">1. Choose Installation</p>
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
                  disabled={isMutating}
                  onSelect={(installationId) => {
                    clearFeedback()
                    setSelectedInstallationId(installationId)
                    setSelectedRepositoryFullName(null)
                    setGitHubBranch("")
                  }}
                />
              ) : (
                <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                  No GitHub App installations are connected yet. Install the GitHub App
                  and then refresh this list.
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
                  disabled={isMutating}
                  onSelect={(repository) => {
                    clearFeedback()
                    setSelectedRepositoryFullName(repository.fullName)
                    setGitHubBranch(repository.defaultBranch ?? "")
                  }}
                />
              ) : (
                <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                  Harbor can see this installation, but no repositories are currently in
                  scope.
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="project-github-branch">
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
              />
              <p className="text-muted-foreground text-xs">
                Harbor stores the repository binding first. You can provision the local
                workspace now or later.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {props.onCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={props.onCancel}
                  disabled={isMutating}
                >
                  {cancelLabel}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleGitHubCreate(false)}
                disabled={isMutating || !selectedRepository}
              >
                Create Without Provisioning
              </Button>
              <Button
                type="button"
                onClick={() => void handleGitHubCreate(true)}
                disabled={isMutating || !selectedRepository}
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

        <TabsContent value="manualGit" className="mt-0">
          <form className="grid gap-4 rounded-lg border p-4" onSubmit={handleManualGitSubmit}>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="project-repository-url">
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
              />
              <p className="text-muted-foreground text-xs">
                Use manual URL mode for public repositories or providers that are not
                connected through GitHub App access.
              </p>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="project-repository-branch">
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
              />
            </div>

            <div className="flex justify-end gap-2">
              {props.onCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={props.onCancel}
                  disabled={isMutating}
                >
                  {cancelLabel}
                </Button>
              ) : null}
              <Button type="submit" disabled={isMutating}>
                {isMutating ? "Creating..." : submitLabel}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>

      {formError ? (
        <div className="grid gap-3 rounded-lg border border-red-200 bg-red-50/60 p-3">
          <p className="text-sm text-red-700">{formError}</p>
          {createdProjectPendingProvision ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onCreated?.(createdProjectPendingProvision)}
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
