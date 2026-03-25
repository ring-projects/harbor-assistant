"use client"

import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

function deriveProjectName(name: string, rootPath: string) {
  const trimmedName = name.trim()
  if (trimmedName) {
    return trimmedName
  }

  return rootPath.split(/[\\/]/).filter(Boolean).at(-1) || rootPath
}

export function CreateProject(props: CreateProjectProps) {
  const {
    className,
    submitLabel = "Create Project",
    cancelLabel = "Cancel",
    pickerTitle = "Project Directory",
    onCreated,
  } = props
  const [rootPath, setRootPath] = useState(props.defaultPath ?? "")
  const [name, setName] = useState(props.defaultName ?? "")
  const [formError, setFormError] = useState<string | null>(null)
  const createMutation = useCreateProjectMutation()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedRootPath = rootPath.trim()
    if (!normalizedRootPath) {
      setFormError("Project root path is required.")
      return
    }

    try {
      setFormError(null)
      const project = await createMutation.mutateAsync({
        rootPath: normalizedRootPath,
        name: deriveProjectName(name, normalizedRootPath),
      })

      onCreated?.(project)
    } catch (error) {
      setFormError(getProjectActionError(error))
    }
  }

  return (
    <form className={cn("grid gap-5 p-5", className)} onSubmit={handleSubmit}>
      {pickerTitle ? (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{pickerTitle}</h3>
          <p className="text-muted-foreground text-sm">
            Enter a local absolute path that the service process can access.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="project-root-path">
            Root Path
          </label>
          <Input
            id="project-root-path"
            value={rootPath}
            onChange={(event) => setRootPath(event.target.value)}
            placeholder="/absolute/path/to/project"
            disabled={createMutation.isPending}
            autoFocus
          />
          <p className="text-muted-foreground text-xs">
            The backend no longer browses global directories for you. Project creation
            now uses an explicit root path.
          </p>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="project-name">
            Name
          </label>
          <Input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Optional. Defaults to the directory name."
            disabled={createMutation.isPending}
          />
        </div>
      </div>

      {formError ? (
        <div className="rounded-md border border-rose-300/70 bg-rose-50/80 px-3 py-2 text-sm text-rose-700">
          {formError}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {props.onCancel ? (
          <Button
            type="button"
            variant="ghost"
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
  )
}
