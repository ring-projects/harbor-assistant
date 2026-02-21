"use client"

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react"
import { FolderOpenIcon, PlusIcon, Trash2Icon } from "lucide-react"

import {
  addWorkspaceAction,
  deleteWorkspaceAction,
} from "@/app/actions/workspaces"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Workspace } from "@/services/workspace/types"
import { useWorkspaceStore } from "@/stores"

type WorkspaceManagerProps = {
  initialWorkspaces: Workspace[]
  initialError?: string | null
}

export function WorkspaceManager(props: WorkspaceManagerProps) {
  const { initialWorkspaces, initialError } = props

  const hydrateWorkspaces = useWorkspaceStore((store) => store.hydrateWorkspaces)
  const [workspaces, setWorkspaces] = useState(initialWorkspaces)
  const [pathValue, setPathValue] = useState("")
  const [nameValue, setNameValue] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError ?? null
  )
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const workspaceCountText = useMemo(() => {
    const count = workspaces.length
    return `${count} workspace${count === 1 ? "" : "s"}`
  }, [workspaces])

  useEffect(() => {
    hydrateWorkspaces(initialWorkspaces)
  }, [hydrateWorkspaces, initialWorkspaces])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    startTransition(async () => {
      const result = await addWorkspaceAction({
        path: pathValue,
        name: nameValue || undefined,
      })

      setWorkspaces(result.workspaces)
      hydrateWorkspaces(result.workspaces)
      if (!result.ok) {
        setErrorMessage(result.error?.message ?? "Failed to add workspace.")
        return
      }

      setPathValue("")
      setNameValue("")
      setErrorMessage(null)
    })
  }

  const onDelete = (id: string) => {
    setPendingDeleteId(id)
    startTransition(async () => {
      const result = await deleteWorkspaceAction({ id })
      setWorkspaces(result.workspaces)
      hydrateWorkspaces(result.workspaces)

      if (!result.ok) {
        setErrorMessage(result.error?.message ?? "Failed to delete workspace.")
      } else {
        setErrorMessage(null)
      }

      setPendingDeleteId(null)
    })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Workspaces</h2>
        <p className="text-muted-foreground text-sm">
          Manage local workspace roots for this desktop app.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-6">
        <label className="md:col-span-3">
          <span className="mb-1 block text-sm font-medium">Path</span>
          <Input
            value={pathValue}
            onChange={(event) => setPathValue(event.target.value)}
            placeholder="/Users/you/workspace/project"
            required
          />
        </label>

        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium">Name (optional)</span>
          <Input
            value={nameValue}
            onChange={(event) => setNameValue(event.target.value)}
            placeholder="Project name"
          />
        </label>

        <div className="flex items-end">
          <Button type="submit" className="w-full" disabled={isPending}>
            <PlusIcon className="size-4" />
            Add
          </Button>
        </div>
      </form>

      {errorMessage ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {errorMessage}
        </div>
      ) : null}

      <div className="text-muted-foreground text-xs">{workspaceCountText}</div>

      {workspaces.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          No workspace configured.
        </div>
      ) : (
        <ul className="space-y-2">
          {workspaces.map((workspace) => (
            <li
              key={workspace.id}
              className="bg-card flex items-center gap-3 rounded-lg border px-3 py-2"
            >
              <FolderOpenIcon className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{workspace.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {workspace.path}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isPending && pendingDeleteId === workspace.id}
                onClick={() => onDelete(workspace.id)}
                aria-label={`Delete workspace ${workspace.name}`}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
