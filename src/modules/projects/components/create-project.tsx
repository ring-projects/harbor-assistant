"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  getProjectActionError,
  useCreateProjectMutation,
} from "@/modules/projects/hooks"
import { createProjectDraft } from "@/modules/projects/state"
import type { Project } from "@/services/project/types"

type CreateProjectProps = {
  className?: string
  submitLabel?: string
  defaultPath?: string
  defaultName?: string
  onCreated?: (projects: Project[]) => void
}

export function CreateProject(props: CreateProjectProps) {
  const { className, submitLabel = "Create Project", onCreated } = props
  const [draft, setDraft] = useState(
    createProjectDraft({
      path: props.defaultPath,
      name: props.defaultName,
    }),
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const createMutation = useCreateProjectMutation()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    const path = draft.path.trim()
    const name = draft.name.trim()
    if (!path) {
      setErrorMessage("Path is required.")
      return
    }

    try {
      const projects = await createMutation.mutateAsync({
        path,
        name: name || undefined,
      })

      onCreated?.(projects)
      setDraft(createProjectDraft({ path: "", name: "" }))
    } catch (error) {
      setErrorMessage(getProjectActionError(error))
    }
  }

  return (
    <form className={cn("space-y-4", className)} onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label htmlFor="create-project-path" className="text-sm font-medium">
          Path
        </label>
        <Input
          id="create-project-path"
          placeholder="/path/to/project"
          value={draft.path}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              path: event.target.value,
            }))
          }
          disabled={createMutation.isPending}
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="create-project-name" className="text-sm font-medium">
          Name (optional)
        </label>
        <Input
          id="create-project-name"
          placeholder="My Project"
          value={draft.name}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          disabled={createMutation.isPending}
        />
      </div>

      {errorMessage ? (
        <p className="text-destructive text-sm">{errorMessage}</p>
      ) : null}

      <Button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Creating..." : submitLabel}
      </Button>
    </form>
  )
}
