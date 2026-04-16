"use client"

import { useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  Building2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  UserIcon,
} from "lucide-react"

import { HarborMark } from "@/components/logo"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  getWorkspaceActionError,
  useCreateWorkspaceMutation,
  useReadWorkspacesQuery,
} from "@/modules/workspaces/hooks"
import { useAppStore } from "@/stores/app.store"

type WorkspaceSwitcherProps = {
  workspaceId: string | null
  className?: string
  triggerClassName?: string
  align?: "start" | "center" | "end"
  variant?: "default" | "sidebar-brand"
}

function orderWorkspaces(
  items: NonNullable<ReturnType<typeof useReadWorkspacesQuery>["data"]>,
  activeWorkspaceId: string | null,
) {
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
}

function getWorkspaceIcon(type: "personal" | "team") {
  return type === "team" ? Building2Icon : UserIcon
}

export function WorkspaceSwitcher({
  workspaceId,
  className,
  triggerClassName,
  align = "start",
  variant = "default",
}: WorkspaceSwitcherProps) {
  const navigate = useNavigate()
  const setActiveWorkspaceId = useAppStore((state) => state.setActiveWorkspaceId)
  const clearActiveProjectId = useAppStore((state) => state.clearActiveProjectId)
  const workspacesQuery = useReadWorkspacesQuery()
  const createWorkspaceMutation = useCreateWorkspaceMutation()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [workspaceName, setWorkspaceName] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)

  const workspaces = workspacesQuery.data ?? []
  const orderedWorkspaces = useMemo(
    () => orderWorkspaces(workspaces, workspaceId),
    [workspaceId, workspaces],
  )
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === workspaceId) ??
    orderedWorkspaces[0] ??
    null

  function openWorkspace(nextWorkspaceId: string) {
    setActiveWorkspaceId(nextWorkspaceId)
    clearActiveProjectId()
    void navigate({
      to: "/workspaces/$workspaceId",
      params: { workspaceId: nextWorkspaceId },
    })
  }

  async function handleCreateWorkspace() {
    const trimmedName = workspaceName.trim()
    if (!trimmedName) {
      setCreateError("Workspace name is required.")
      return
    }

    try {
      const workspace = await createWorkspaceMutation.mutateAsync({
        name: trimmedName,
      })
      setWorkspaceName("")
      setCreateError(null)
      setCreateDialogOpen(false)
      openWorkspace(workspace.id)
    } catch (error) {
      setCreateError(getWorkspaceActionError(error))
    }
  }

  const ActiveIcon = activeWorkspace ? getWorkspaceIcon(activeWorkspace.type) : UserIcon
  const workspaceTypeLabel =
    activeWorkspace?.type === "team" ? "Team" : "Personal"

  return (
    <>
      <div className={cn("min-w-0", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {variant === "sidebar-brand" ? (
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-14 w-full min-w-0 justify-between rounded-xl px-2.5",
                  triggerClassName,
                )}
              >
                <span className="flex min-w-0 items-center gap-3 text-left">
                  <span className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60">
                    <HarborMark className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {activeWorkspace?.name ?? "Workspace"}
                      </span>
                      <span className="bg-secondary text-secondary-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium">
                        {workspaceTypeLabel}
                      </span>
                    </span>
                  </span>
                </span>
                <ChevronsUpDownIcon className="text-muted-foreground size-4 shrink-0" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-10 w-full min-w-0 justify-between rounded-lg border-border/70 bg-background px-3 shadow-none",
                  triggerClassName,
                )}
              >
                <span className="flex min-w-0 items-center gap-3 text-left">
                  <span className="bg-secondary text-secondary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                    <ActiveIcon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {activeWorkspace?.name ?? "Workspace"}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {activeWorkspace?.type === "team"
                        ? "Team workspace"
                        : "Personal workspace"}
                    </span>
                  </span>
                </span>
                <ChevronsUpDownIcon className="text-muted-foreground size-4 shrink-0" />
              </Button>
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent align={align} className="w-80 rounded-lg p-2">
            <DropdownMenuLabel className="px-2 pb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>

            {orderedWorkspaces.map((workspace) => {
              const WorkspaceIcon = getWorkspaceIcon(workspace.type)
              const isActive = workspace.id === activeWorkspace?.id

              return (
                <DropdownMenuItem
                  key={workspace.id}
                  className="items-start gap-3 rounded-md px-3 py-2"
                  onSelect={() => openWorkspace(workspace.id)}
                >
                  <span className="bg-secondary text-secondary-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md">
                    <WorkspaceIcon className="size-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {workspace.name}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {workspace.type === "team"
                        ? `${workspace.memberships.filter((membership) => membership.status === "active").length} active members`
                        : "Personal workspace"}
                    </span>
                  </span>

                  {isActive ? <CheckIcon className="size-4 shrink-0" /> : null}
                </DropdownMenuItem>
              )
            })}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="gap-3 rounded-md px-3 py-2"
              onSelect={() => {
                setCreateError(null)
                setCreateDialogOpen(true)
              }}
            >
              <span className="bg-secondary text-secondary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                <PlusIcon className="size-4" />
              </span>
              <span className="font-medium">Create workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>
              Add a team workspace for shared projects, members, and integrations.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              value={workspaceName}
              onChange={(event) => {
                setCreateError(null)
                setWorkspaceName(event.target.value)
              }}
              placeholder="For example: Platform Team"
              disabled={createWorkspaceMutation.isPending}
            />

            {createError ? (
              <p className="text-destructive text-sm">{createError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => void handleCreateWorkspace()}
              disabled={createWorkspaceMutation.isPending}
            >
              {createWorkspaceMutation.isPending ? "Creating..." : "Create workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
