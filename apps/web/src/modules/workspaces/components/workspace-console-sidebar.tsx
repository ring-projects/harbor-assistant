"use client"

import { Link, useLocation } from "@tanstack/react-router"
import { FolderPlusIcon, LayoutGridIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useReadProjectsQuery } from "@/modules/projects/hooks"
import { useAppStore } from "@/stores/app.store"
import { useUiStore } from "@/stores/ui.store"
import { WorkspaceSwitcher } from "./workspace-switcher"

type WorkspaceConsoleSidebarProps = {
  workspaceId: string
}

function matchActiveProjectId(pathname: string, workspaceId: string) {
  const encodedWorkspaceId = encodeURIComponent(workspaceId)
  const escapedWorkspaceId = encodedWorkspaceId.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  )
  const match = pathname.match(
    new RegExp(`/workspaces/${escapedWorkspaceId}/projects/([^/]+)`),
  )

  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export function WorkspaceConsoleSidebar({
  workspaceId,
}: WorkspaceConsoleSidebarProps) {
  const location = useLocation()
  const activeProjectId = matchActiveProjectId(location.pathname, workspaceId)
  const setActiveProjectId = useAppStore((state) => state.setActiveProjectId)
  const projectsQuery = useReadProjectsQuery({ workspaceId })
  const openAddProjectModal = useUiStore((state) => state.openAddProjectModal)

  const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`

  return (
    <aside className="border-border/60 bg-background/95 flex h-full w-[15.25rem] shrink-0 flex-col border-r backdrop-blur">
      <div className="border-b border-border/60 px-3 py-3">
        <WorkspaceSwitcher
          workspaceId={workspaceId}
          variant="sidebar-brand"
        />
      </div>

      <div className="px-3">
        <nav className="grid gap-1">
          <Link
            to="/workspaces/$workspaceId"
            params={{ workspaceId }}
            onClick={() => setActiveProjectId(null)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              location.pathname === workspacePath ||
                location.pathname === `${workspacePath}/`
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
            )}
          >
            <LayoutGridIcon className="size-4" />
            Overview
          </Link>

          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground h-auto justify-start rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary/70 hover:text-foreground"
            onClick={() => openAddProjectModal(workspaceId)}
          >
            <FolderPlusIcon className="size-4" />
            Add project
          </Button>
        </nav>
      </div>

      <Separator className="my-2" />

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.16em]">
            Projects
          </p>
          <span className="text-muted-foreground text-[11px]">
            {projectsQuery.data?.length ?? 0}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-1">
            {projectsQuery.data?.map((project) => {
              const isActive = activeProjectId === project.id

              return (
                <Link
                  key={project.id}
                  to="/workspaces/$workspaceId/projects/$projectId"
                  params={{ workspaceId, projectId: project.id }}
                  onClick={() => setActiveProjectId(project.id)}
                  className={cn(
                    "rounded-lg border border-transparent px-3 py-2 transition-colors",
                    isActive
                      ? "border-border bg-secondary"
                      : "hover:border-border/70 hover:bg-secondary/50",
                  )}
                >
                  <p className="truncate text-sm font-medium leading-5">{project.name}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-4">
                    {project.source.type === "git"
                      ? project.source.repositoryUrl
                      : project.rootPath ?? project.source.rootPath}
                  </p>
                </Link>
              )
            })}

            {projectsQuery.isLoading ? (
              <div className="text-muted-foreground px-3 py-3 text-sm">
                Loading projects...
              </div>
            ) : null}

            {!projectsQuery.isLoading && !projectsQuery.data?.length ? (
              <div className="text-muted-foreground rounded-xl border border-dashed px-3 py-4 text-sm">
                No projects yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  )
}
