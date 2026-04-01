"use client"

import { Link, useLocation } from "@tanstack/react-router"
import {
  BotIcon,
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
  projectId,
  className,
  initialProjects,
}: ProjectSidebarProps) {
  const location = useLocation()
  const projectPath = `/${encodeURIComponent(projectId)}`
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
          <ProjectSwitcher
            activeProjectId={projectId}
            initialProjects={initialProjects}
            triggerLabel="Open project switcher"
            className="max-w-none justify-center gap-0"
          >
            <HarborMark className="size-7" />
          </ProjectSwitcher>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="p-2">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === projectPath}
                        className="size-12 justify-center p-0 [&>svg]:size-5"
                      >
                        <Link
                          to="/$projectId"
                          params={{ projectId }}
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
                          to="/$projectId/settings"
                          params={{ projectId }}
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
