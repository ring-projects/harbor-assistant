"use client"

import Image from "next/image"
import Link from "next/link"
import { useParams } from "next/navigation"
import { FolderOpenIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  SidebarContent,
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
import type { Project } from "@/modules/projects/types"
import { useUiStore } from "@/stores/ui.store"

type ProjectsListProps = {
  activeProjectId?: string
  className?: string
  initialProjects?: Project[]
}

export function ProjectsList({
  activeProjectId,
  className,
  initialProjects,
}: ProjectsListProps) {
  const params = useParams<{ project_id?: string | string[] }>()
  const openAddProjectModal = useUiStore((state) => state.openAddProjectModal)
  const projectsQuery = useReadProjectsQuery({
    initialData: initialProjects,
  })
  const routeProjectId = params.project_id
  const resolvedActiveProjectId =
    activeProjectId ??
    (Array.isArray(routeProjectId) ? routeProjectId[0] : routeProjectId)

  return (
    <>
      <SidebarHeader className={cn("gap-3 p-4", className)}>
        <Image
          src="/brand/harbor-logo-black.svg"
          alt="Harbor logo"
          width={493}
          height={97}
          className="h-auto w-30"
          draggable={false}
        />
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Projects</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Add project"
            onClick={() => openAddProjectModal()}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {projectsQuery.isLoading ? (
              <div className="space-y-1">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SidebarMenuSkeleton key={index} showIcon />
                ))}
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
                      isActive={project.id === resolvedActiveProjectId}
                      tooltip={project.path}
                      className="h-auto py-2"
                    >
                      <Link href={`/${encodeURIComponent(project.id)}`}>
                        <FolderOpenIcon
                          className="text-muted-foreground size-4 shrink-0"
                          aria-hidden="true"
                        />
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
    </>
  )
}
