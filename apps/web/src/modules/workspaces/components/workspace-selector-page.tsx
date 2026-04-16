"use client"

import { useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { ArrowRightIcon, Building2Icon, PlusIcon, UserIcon } from "lucide-react"

import { HarborMark } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  getWorkspaceActionError,
  useCreateWorkspaceMutation,
  useReadWorkspacesQuery,
} from "@/modules/workspaces/hooks"
import { useAppStore } from "@/stores/app.store"

export function WorkspaceSelectorPage() {
  const navigate = useNavigate()
  const setActiveWorkspaceId = useAppStore((state) => state.setActiveWorkspaceId)
  const clearActiveProjectId = useAppStore((state) => state.clearActiveProjectId)
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId)
  const workspacesQuery = useReadWorkspacesQuery()
  const createWorkspaceMutation = useCreateWorkspaceMutation()
  const [teamWorkspaceName, setTeamWorkspaceName] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    clearActiveProjectId()
  }, [clearActiveProjectId])

  const orderedWorkspaces = useMemo(() => {
    const items = workspacesQuery.data ?? []
    return [...items].sort((left, right) => {
      if (left.id === activeWorkspaceId) {
        return -1
      }
      if (right.id === activeWorkspaceId) {
        return 1
      }
      if (left.type === "personal" && right.type !== "personal") {
        return -1
      }
      if (left.type !== "personal" && right.type === "personal") {
        return 1
      }
      return left.name.localeCompare(right.name)
    })
  }, [activeWorkspaceId, workspacesQuery.data])

  function openWorkspace(workspaceId: string) {
    setActiveWorkspaceId(workspaceId)
    void navigate({
      to: "/workspaces/$workspaceId",
      params: { workspaceId },
    })
  }

  async function handleCreateWorkspace() {
    const trimmedName = teamWorkspaceName.trim()
    if (!trimmedName) {
      setCreateError("Workspace name is required.")
      return
    }

    try {
      setCreateError(null)
      const workspace = await createWorkspaceMutation.mutateAsync({
        name: trimmedName,
      })
      setTeamWorkspaceName("")
      openWorkspace(workspace.id)
    } catch (error) {
      setCreateError(getWorkspaceActionError(error))
    }
  }

  return (
    <div className="bg-background text-foreground min-h-svh">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="flex items-center gap-3">
          <HarborMark width={24} height={24} className="size-6 shrink-0" />
          <div>
            <p className="text-sm font-medium">Harbor Assistant</p>
            <p className="text-muted-foreground text-sm">
              Choose a workspace before opening projects.
            </p>
          </div>
        </header>

        <main className="grid flex-1 gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <section className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Select a workspace
              </h1>
              <p className="text-muted-foreground max-w-2xl text-base leading-7">
                Harbor now scopes projects, members, and GitHub access under
                workspaces. Start by choosing the workspace you want to enter.
              </p>
            </div>

            <div className="grid gap-3">
              {workspacesQuery.isLoading ? (
                <div className="text-muted-foreground rounded-lg border p-4 text-sm">
                  Loading workspaces...
                </div>
              ) : null}

              {workspacesQuery.isError ? (
                <div className="bg-surface-danger text-destructive rounded-lg border border-destructive/25 p-4 text-sm">
                  {getWorkspaceActionError(workspacesQuery.error)}
                </div>
              ) : null}

              {!workspacesQuery.isLoading && !workspacesQuery.isError
                ? orderedWorkspaces.map((workspace) => {
                    const isActive = workspace.id === activeWorkspaceId

                    return (
                      <button
                        key={workspace.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between gap-4 rounded-lg border px-5 py-4 text-left transition-colors",
                          isActive
                            ? "border-foreground/30 bg-accent"
                            : "border-border hover:bg-accent/60",
                        )}
                        onClick={() => openWorkspace(workspace.id)}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            {workspace.type === "team" ? (
                              <Building2Icon className="text-muted-foreground size-4 shrink-0" />
                            ) : (
                              <UserIcon className="text-muted-foreground size-4 shrink-0" />
                            )}
                            <span className="truncate font-medium">
                              {workspace.name}
                            </span>
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {workspace.type === "personal"
                              ? "Personal workspace"
                              : `${workspace.memberships.filter((membership) => membership.status === "active").length} active members`}
                          </p>
                        </div>

                        <ArrowRightIcon className="text-muted-foreground size-4 shrink-0" />
                      </button>
                    )
                  })
                : null}
            </div>
          </section>

          <aside className="bg-card flex flex-col gap-5 rounded-xl border p-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Create team workspace</p>
              <p className="text-muted-foreground text-sm leading-6">
                Personal workspaces are prepared automatically. Create a team
                workspace when you need a shared container for projects and
                members.
              </p>
            </div>

            <div className="grid gap-3">
              <Input
                value={teamWorkspaceName}
                onChange={(event) => {
                  setCreateError(null)
                  setTeamWorkspaceName(event.target.value)
                }}
                placeholder="For example: Harbor Team"
                disabled={createWorkspaceMutation.isPending}
              />

              {createError ? (
                <p className="text-destructive text-sm">{createError}</p>
              ) : null}

              <Button
                type="button"
                onClick={() => void handleCreateWorkspace()}
                disabled={createWorkspaceMutation.isPending}
              >
                <PlusIcon className="size-4" />
                {createWorkspaceMutation.isPending
                  ? "Creating..."
                  : "Create workspace"}
              </Button>
            </div>
          </aside>
        </main>
      </div>
    </div>
  )
}
