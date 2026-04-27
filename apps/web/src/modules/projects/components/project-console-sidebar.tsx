"use client"

import { Link, useLocation } from "@tanstack/react-router"
import {
  Clock3Icon,
  FolderGit2Icon,
  MessageSquareMoreIcon,
  Settings2Icon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { SidebarUserPanel } from "@/modules/auth/components/sidebar-user-panel"
import { ProjectSwitcher } from "@/modules/projects/components/project-switcher"
import { useProjectQuery } from "@/modules/projects/hooks"

type ProjectConsoleSidebarProps = {
  workspaceId: string
  projectId: string
}

export function ProjectConsoleSidebar({
  workspaceId,
  projectId,
}: ProjectConsoleSidebarProps) {
  const location = useLocation()
  const projectQuery = useProjectQuery(projectId)
  const projectPath = `/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}`
  const schedulePath = `${projectPath}/schedule`
  const settingsPath = `${projectPath}/settings`
  const pathname = location.pathname
  const isHumanLoopActive =
    pathname === projectPath || pathname === `${projectPath}/`
  const isScheduleActive = pathname === schedulePath
  const isSettingsActive = pathname === settingsPath

  return (
    <aside className="border-border/60 bg-card text-foreground flex h-full w-[15.25rem] shrink-0 flex-col border-r">
      <div className="border-border/60 flex h-14 items-center border-b px-3">
        <ProjectSwitcher
          workspaceId={workspaceId}
          activeProjectId={projectId}
          className="w-full"
          triggerClassName="h-10 rounded-lg border-border/70 bg-background px-3 shadow-none"
          triggerLabel="Switch project"
        >
          <span className="flex min-w-0 items-center gap-3 text-left">
            <span className="bg-secondary text-secondary-foreground border-border/60 flex size-10 shrink-0 items-center justify-center rounded-xl border">
              <FolderGit2Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {projectQuery.data?.name ?? "Project"}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {projectQuery.data?.source.type === "git"
                  ? "Git-backed project"
                  : "Local project"}
              </span>
            </span>
          </span>
        </ProjectSwitcher>
      </div>

      <div className="flex flex-1 flex-col px-3 py-3">
        <nav className="grid gap-1">
          <Link
            to="/workspaces/$workspaceId/projects/$projectId"
            params={{ workspaceId, projectId }}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isHumanLoopActive
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
            )}
          >
            <MessageSquareMoreIcon className="size-4" />
            Human Loop
          </Link>

          <Link
            to="/workspaces/$workspaceId/projects/$projectId/schedule"
            params={{ workspaceId, projectId }}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isScheduleActive
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
            )}
          >
            <Clock3Icon className="size-4" />
            Schedule
          </Link>

          <Link
            to="/workspaces/$workspaceId/projects/$projectId/settings"
            params={{ workspaceId, projectId }}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isSettingsActive
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
            )}
          >
            <Settings2Icon className="size-4" />
            Settings
          </Link>
        </nav>
      </div>

      <SidebarUserPanel />
    </aside>
  )
}
