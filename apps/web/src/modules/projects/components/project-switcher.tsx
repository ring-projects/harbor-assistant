"use client"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import {
  CheckIcon,
  ChevronsUpDownIcon,
  FolderOpenIcon,
  PlusIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { HarborLogo } from "@/components/logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { useReadProjectsQuery } from "@/modules/projects/hooks"
import type { Project } from "@/modules/projects/types"
import { useAppStore } from "@/stores/app.store"
import { useUiStore } from "@/stores/ui.store"

type ProjectSwitcherProps = {
  activeProjectId: string
  initialProjects?: Project[]
  className?: string
}

export function ProjectSwitcher({
  activeProjectId,
  initialProjects,
  className,
}: ProjectSwitcherProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const setActiveProjectId = useAppStore((state) => state.setActiveProjectId)
  const openAddProjectModal = useUiStore((state) => state.openAddProjectModal)
  const projectsQuery = useReadProjectsQuery({
    initialData: initialProjects,
  })
  const projectItems = projectsQuery.data ?? []

  const activeProject = useMemo(
    () =>
      projectItems?.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projectItems],
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "max-w-[22rem] min-w-0 justify-between gap-3",
            className,
          )}
        >
          <HarborLogo className="w-24" />
          <ChevronsUpDownIcon className="text-muted-foreground ml-auto size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-80 rounded-lg"
        align="start"
        side={isMobile ? "bottom" : "bottom"}
        sideOffset={6}
      >
        {projectItems.length ? (
          projectItems.map((project) => {
            const isActive = project.id === activeProjectId

            return (
              <DropdownMenuItem
                key={project.id}
                className="gap-2 p-2"
                onSelect={() => {
                  setActiveProjectId(project.id)
                  router.push(`/${encodeURIComponent(project.id)}`)
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{project.name}</div>
                  <div className="text-muted-foreground truncate text-xs">
                    {project.path}
                  </div>
                </div>

                <span className="flex size-4 items-center justify-center">
                  {isActive ? <CheckIcon className="size-4" /> : null}
                </span>
              </DropdownMenuItem>
            )
          })
        ) : (
          <div className="text-accent-foreground p-2 text-sm font-bold">
            No projects found
          </div>
        )}

        <DropdownMenuItem
          className="gap-2 p-2"
          onSelect={() => openAddProjectModal()}
        >
          <PlusIcon className="size-4" />
          <div className="text-muted-foreground font-medium">Add project</div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
