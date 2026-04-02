"use client"

import { useState, type FormEvent } from "react"

import { DirectoryPicker } from "@/components/directory-picker"
import { statBootstrapDirectorySelection } from "@/components/directory-picker/directory-picker-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  getProjectActionError,
  useCreateProjectMutation,
} from "@/modules/projects/hooks"
import type { Project } from "@/modules/projects/types"

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

type CreateSourceMode = "rootPath" | "git"

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
  const [repositoryUrl, setRepositoryUrl] = useState("")
  const [branch, setBranch] = useState("")
  const createMutation = useCreateProjectMutation()

  async function handleRootPathConfirm(selection: {
    rootId: string
    rootPath: string
    path: string
  }) {
    try {
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
      throw new Error(getProjectActionError(error))
    }
  }

  async function handleGitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const trimmedRepositoryUrl = repositoryUrl.trim()
      const project = await createMutation.mutateAsync({
        name: deriveProjectName(name, deriveNameFromRepositoryUrl(trimmedRepositoryUrl)),
        source: {
          type: "git",
          repositoryUrl: trimmedRepositoryUrl,
          branch: branch.trim() || null,
        },
      })

      onCreated?.(project)
    } catch (error) {
      throw new Error(getProjectActionError(error))
    }
  }

  return (
    <div className={cn("grid gap-5 p-5", className)}>
      {pickerTitle ? (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{pickerTitle}</h3>
          <p className="text-muted-foreground text-sm">
            Create a project from a server-local workspace or a git repository.
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
          onChange={(event) => setName(event.target.value)}
          placeholder="Optional. Defaults to the selected path or repository name."
          disabled={createMutation.isPending}
        />
        <p className="text-muted-foreground text-xs">
          Leave this blank to derive the project name from the selected source.
        </p>
      </div>

      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as CreateSourceMode)}
        className="grid gap-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rootPath">Local Path</TabsTrigger>
          <TabsTrigger value="git">Git Repository</TabsTrigger>
        </TabsList>

        <TabsContent value="rootPath" className="mt-0">
          <DirectoryPicker
            className="border-border/70"
            title={null}
            confirmLabel={createMutation.isPending ? "Creating..." : submitLabel}
            cancelLabel={cancelLabel}
            initialPath={props.defaultPath}
            disabled={createMutation.isPending}
            onConfirm={handleRootPathConfirm}
            onCancel={props.onCancel}
          />
        </TabsContent>

        <TabsContent value="git" className="mt-0">
          <form className="grid gap-4 rounded-lg border p-4" onSubmit={handleGitSubmit}>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="project-repository-url">
                Repository URL
              </label>
              <Input
                id="project-repository-url"
                value={repositoryUrl}
                onChange={(event) => setRepositoryUrl(event.target.value)}
                placeholder="https://github.com/acme/harbor-assistant.git"
                disabled={createMutation.isPending}
                required
              />
              <p className="text-muted-foreground text-xs">
                Harbor stores the repository source now and can provision a local
                workspace later.
              </p>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="project-repository-branch">
                Default Branch
              </label>
              <Input
                id="project-repository-branch"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                placeholder="Optional. For example: main"
                disabled={createMutation.isPending}
              />
            </div>

            <div className="flex justify-end gap-2">
              {props.onCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={props.onCancel}
                  disabled={createMutation.isPending}
                >
                  {cancelLabel}
                </Button>
              ) : null}
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : submitLabel}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
