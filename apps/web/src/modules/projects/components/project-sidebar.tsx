"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
  href?: string
  icon: LucideIcon
}

export function ProjectSidebar({
  projectId,
  className,
  initialProjects,
}: ProjectSidebarProps) {
  const pathname = usePathname()
  const encodedProjectId = encodeURIComponent(projectId)

  const items: ProjectSidebarItem[] = [
    {
      key: "agent",
      label: "agent",
      tip: "Agent workspace",
      href: `/${encodedProjectId}`,
      icon: BotIcon,
    },
    {
      key: "research",
      label: "research",
      tip: "Research view coming soon",
      icon: SearchIcon,
    },
    {
      key: "setting",
      label: "setting",
      tip: "Project settings",
      href: `/${encodedProjectId}/settings`,
      icon: Settings2Icon,
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
                {items.map((item) => {
                  const isActive = item.href ? pathname === item.href : false
                  const Icon = item.icon

                  return (
                    <SidebarMenuItem key={item.key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {item.href ? (
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              className="size-12 justify-center p-0 [&>svg]:size-5"
                            >
                              <Link href={item.href} aria-label={item.label}>
                                <Icon aria-hidden="true" />
                              </Link>
                            </SidebarMenuButton>
                          ) : (
                            <SidebarMenuButton
                              type="button"
                              disabled
                              aria-label={item.label}
                              className="size-12 justify-center p-0 [&>svg]:size-5"
                            >
                              <Icon aria-hidden="true" />
                            </SidebarMenuButton>
                          )}
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
