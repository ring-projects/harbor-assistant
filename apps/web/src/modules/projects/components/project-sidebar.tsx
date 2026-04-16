"use client"

import { Link, useLocation } from "@tanstack/react-router"
import {
  BotIcon,
  HomeIcon,
  SearchIcon,
  Settings2Icon,
  type LucideIcon,
} from "lucide-react"

import { HarborMark } from "@/components/logo"
import type { Project } from "@/modules/projects/types"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ProjectSwitcher } from "./project-switcher"

type ProjectSidebarProps = {
  workspaceId: string
  projectId: string
  className?: string
  initialProjects?: Project[]
}

type ProjectSidebarItem = {
  key: string
  label: string
  tip: string
  icon: LucideIcon
}

export function ProjectSidebar({
  workspaceId,
  projectId,
  className,
  initialProjects,
}: ProjectSidebarProps) {
  const location = useLocation()
  const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`
  const projectPath = `${workspacePath}/projects/${encodeURIComponent(projectId)}`
  const settingsPath = `${projectPath}/settings`
  const pathname = location.pathname

  const items: ProjectSidebarItem[] = [
    {
      key: "research",
      label: "research",
      tip: "Research view coming soon",
      icon: SearchIcon,
    },
  ]

  return (
    <SidebarProvider
      className="h-full min-h-0 w-auto"
      style={
        {
          "--sidebar-width": "4.25rem",
        } as React.CSSProperties
      }
    >
        <Sidebar
        collapsible="none"
        className={cn("border-border/60 w-16 border-r", className)}
      >
        <SidebarHeader className="border-border/60 h-14 items-center border-b">
          <Link
            to="/workspaces/$workspaceId"
            params={{ workspaceId }}
            className="flex size-12 items-center justify-center"
            aria-label="Open workspace overview"
          >
            <HarborMark className="size-7" />
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="p-2">
            <SidebarGroupContent>
              <div className="mb-2">
                <ProjectSwitcher
                  workspaceId={workspaceId}
                  activeProjectId={projectId}
                  initialProjects={initialProjects}
                  triggerLabel="Open project switcher"
                  className="h-10 w-full justify-between px-2"
                >
                  <span className="text-xs font-medium">Projects</span>
                </ProjectSwitcher>
              </div>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === workspacePath}
                        className="size-12 justify-center p-0 [&>svg]:size-5"
                      >
                        <Link
                          to="/workspaces/$workspaceId"
                          params={{ workspaceId }}
                          aria-label="workspace overview"
                        >
                          <HomeIcon
                            aria-hidden="true"
                            className={cn(pathname === workspacePath && "text-primary")}
                          />
                        </Link>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center">
                      Workspace overview
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === projectPath}
                        className="size-12 justify-center p-0 [&>svg]:size-5"
                      >
                        <Link
                          to="/workspaces/$workspaceId/projects/$projectId"
                          params={{ workspaceId, projectId }}
                          aria-label="agent"
                        >
                          <BotIcon
                            aria-hidden="true"
                            className={cn(pathname === projectPath && "text-primary")}
                          />
                        </Link>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center">
                      Agent workspace
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === settingsPath}
                        className="size-12 justify-center p-0 [&>svg]:size-5"
                      >
                        <Link
                          to="/workspaces/$workspaceId/projects/$projectId/settings"
                          params={{ workspaceId, projectId }}
                          aria-label="setting"
                        >
                          <Settings2Icon
                            aria-hidden="true"
                            className={cn(pathname === settingsPath && "text-primary")}
                          />
                        </Link>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center">
                      Project settings
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>

                {items.map((item) => {
                  const Icon = item.icon

                  return (
                    <SidebarMenuItem key={item.key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            type="button"
                            disabled
                            aria-label={item.label}
                            className="size-12 justify-center p-0 [&>svg]:size-5"
                          >
                            <Icon aria-hidden="true" />
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center">
                          {item.tip}
                        </TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  )
}
