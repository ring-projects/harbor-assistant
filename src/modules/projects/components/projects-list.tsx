"use client"

import Link from "next/link"

import { HarborLogo } from "@/components/logo"
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { useReadProjectsQuery } from "@/modules/projects/hooks"

type ProjectsListProps = {
  activeProjectId: string
  className?: string
}

export function ProjectsList({ activeProjectId, className }: ProjectsListProps) {
  const projectsQuery = useReadProjectsQuery()

  return (
    <>
      <SidebarHeader className={cn("gap-3 p-4", className)}>
        <HarborLogo className="w-30" priority />
        <div>
          <p className="text-sm font-semibold">Projects</p>
          <p className="text-muted-foreground text-xs">
            Select an active project to continue.
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {projectsQuery.isLoading ? (
              <SidebarMenu>
                {Array.from({ length: 6 }).map((_, index) => (
                  <SidebarMenuItem key={index}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : null}

            {!projectsQuery.isLoading && projectsQuery.isError ? (
              <div className="text-destructive rounded-md border p-3 text-xs">
                Failed to load projects.
              </div>
            ) : null}

            {!projectsQuery.isLoading &&
            !projectsQuery.isError &&
            (projectsQuery.data?.length ?? 0) === 0 ? (
              <div className="text-muted-foreground rounded-md border p-3 text-xs">
                No projects found.
              </div>
            ) : null}

            {!projectsQuery.isLoading &&
            !projectsQuery.isError &&
            (projectsQuery.data?.length ?? 0) > 0 ? (
              <SidebarMenu>
                {projectsQuery.data?.map((project) => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={project.id === activeProjectId}
                      tooltip={project.path}
                      className="h-auto py-2"
                    >
                      <Link href={`/${encodeURIComponent(project.id)}`}>
                        <span className="truncate font-medium">{project.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : null}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="text-muted-foreground rounded-md border px-3 py-2 text-xs">
          Project switcher
        </div>
      </SidebarFooter>
    </>
  )
}
