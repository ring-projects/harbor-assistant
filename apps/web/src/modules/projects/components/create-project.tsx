"use client"

import { useState } from "react"

import { DirectoryPicker } from "@/components/directory-picker"
import { statBootstrapDirectorySelection } from "@/components/directory-picker/directory-picker-api"
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
  const [name, setName] = useState(props.defaultName ?? "")
  const createMutation = useCreateProjectMutation()

  async function handleConfirm(selection: {
    rootId: string
    rootPath: string
    path: string
  }) {
    try {
      const pathInfo = await statBootstrapDirectorySelection(selection)
      const project = await createMutation.mutateAsync({
        rootPath: pathInfo.absolutePath,
        name: deriveProjectName(name, pathInfo.absolutePath),
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
            Select a local directory that the service process can access.
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
          placeholder="Optional. Defaults to the selected directory name."
          disabled={createMutation.isPending}
        />
        <p className="text-muted-foreground text-xs">
          The project name is optional. If left blank, Harbor uses the selected
          directory name.
        </p>
      </div>

      <DirectoryPicker
        className="border-border/70"
        title={null}
        confirmLabel={createMutation.isPending ? "Creating..." : submitLabel}
        cancelLabel={cancelLabel}
        initialPath={props.defaultPath}
        disabled={createMutation.isPending}
        onConfirm={handleConfirm}
        onCancel={props.onCancel}
      />
    </div>
  )
}
