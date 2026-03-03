"use client"

import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
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
import { AddProjectModal } from "@/modules/projects/modal"
import type { Project } from "@/services/project/types"

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
  const router = useRouter()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const projectsQuery = useReadProjectsQuery({
    initialData: initialProjects,
  })
  const routeProjectId = params.project_id
  const resolvedActiveProjectId =
    activeProjectId ??
    (Array.isArray(routeProjectId) ? routeProjectId[0] : routeProjectId)

  function handleProjectCreated(projects: Project[]) {
    const nextProject = projects[0]
    if (!nextProject) {
      return
    }

    router.push(`/${nextProject.id}`)
  }

  return (
    <>
      <SidebarHeader className={cn("gap-3 p-4", className)}>
        <img
          src="/brand/harbor-logo-black.svg"
          alt="Harbor logo"
          width={493}
          height={97}
          className="h-auto w-30"
          draggable={false}
        />
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold">Projects</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Add project"
              onClick={() => setIsAddModalOpen(true)}
            >
              <PlusIcon className="size-4" />
            </Button>
          </div>
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
                      isActive={project.id === resolvedActiveProjectId}
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

      <AddProjectModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onCreated={handleProjectCreated}
      />
    </>
  )
}
