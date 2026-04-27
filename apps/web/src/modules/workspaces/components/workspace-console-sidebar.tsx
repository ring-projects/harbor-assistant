"use client"

import { Link, useLocation } from "@tanstack/react-router"
import { LayoutGridIcon } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { SidebarUserPanel } from "@/modules/auth/components/sidebar-user-panel"
import { useReadProjectsQuery } from "@/modules/projects/hooks"
import { useAppStore } from "@/stores/app.store"
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

  const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`

  return (
    <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground flex h-full w-[15.25rem] shrink-0 flex-col border-r">
      <div className="border-sidebar-border border-b px-3 py-3">
        <WorkspaceSwitcher workspaceId={workspaceId} variant="sidebar-brand" />
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
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
            )}
          >
            <LayoutGridIcon className="size-4" />
            Overview
          </Link>
        </nav>
      </div>

      <Separator className="bg-sidebar-border my-2" />

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-sidebar-foreground/55 text-[11px] font-semibold tracking-[0.16em] uppercase">
            Projects
          </p>
          <span className="text-sidebar-foreground/55 text-[11px]">
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
                      ? "border-sidebar-border bg-sidebar-accent"
                      : "hover:border-sidebar-border/70 hover:bg-sidebar-accent/50",
                  )}
                >
                  <p className="truncate text-sm leading-5 font-medium">
                    {project.name}
                  </p>
                  <p className="text-sidebar-foreground/55 mt-0.5 truncate text-[11px] leading-4">
                    {project.source.type === "git"
                      ? project.source.repositoryUrl
                      : (project.rootPath ?? project.source.rootPath)}
                  </p>
                </Link>
              )
            })}

            {projectsQuery.isLoading ? (
              <div className="text-sidebar-foreground/60 px-3 py-3 text-sm">
                Loading projects...
              </div>
            ) : null}

            {!projectsQuery.isLoading && !projectsQuery.data?.length ? (
              <div className="text-sidebar-foreground/60 border-sidebar-border/80 rounded-xl border border-dashed px-3 py-4 text-sm">
                No projects yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <SidebarUserPanel />
    </aside>
  )
}
