"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  FolderOpenIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  getProjectActionError,
  useDeleteProjectMutation,
  useReadProjectsQuery,
} from "@/modules/projects/hooks"
import { AddProjectModal } from "@/modules/projects/modal"
import type { Project } from "@/modules/projects/types"

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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const projectsQuery = useReadProjectsQuery({
    initialData: initialProjects,
  })
  const deleteProjectMutation = useDeleteProjectMutation()

  const activeProject = useMemo(
    () => projectsQuery.data?.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projectsQuery.data],
  )

  function handleProjectCreated(projects: Project[]) {
    const nextProject = projects[0]
    if (!nextProject) {
      return
    }

    router.push(`/${encodeURIComponent(nextProject.id)}`)
  }

  async function handleDeleteProject() {
    if (!activeProject || deleteProjectMutation.isPending) {
      return
    }

    try {
      setDeleteError(null)
      const nextProjects = await deleteProjectMutation.mutateAsync(activeProject.id)
      setIsDeleteDialogOpen(false)

      const nextProject = nextProjects[0]
      if (nextProject) {
        router.push(`/${encodeURIComponent(nextProject.id)}`)
        return
      }

      router.push("/")
    } catch (error) {
      setDeleteError(getProjectActionError(error))
    }
  }

  return (
    <>
      <div className={cn("flex items-center gap-3", className)}>
        <Image
          src="/brand/harbor-logo-black.svg"
          alt="Harbor logo"
          width={493}
          height={97}
          className="h-auto w-24 shrink-0"
          draggable={false}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="max-w-[22rem] justify-between gap-3 px-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FolderOpenIcon className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 truncate text-left">
                  {activeProject?.name ?? "Select project"}
                </span>
              </span>
              <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-[24rem]">
            <DropdownMenuLabel>Switch Project</DropdownMenuLabel>

            {projectsQuery.data?.length ? (
              projectsQuery.data.map((project) => {
                const isActive = project.id === activeProjectId

                return (
                  <DropdownMenuItem
                    key={project.id}
                    className="items-start gap-3 py-2"
                    onSelect={() =>
                      router.push(`/${encodeURIComponent(project.id)}`)
                    }
                  >
                    <span className="flex h-5 w-4 items-center justify-center">
                      {isActive ? <CheckIcon className="size-4" /> : null}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{project.name}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {project.path}
                      </span>
                    </span>
                  </DropdownMenuItem>
                )
              })
            ) : (
              <div className="text-muted-foreground px-2 py-3 text-sm">
                No projects found.
              </div>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={() => setIsAddModalOpen(true)}>
              <PlusIcon className="size-4" />
              Add Project
            </DropdownMenuItem>

            {activeProject ? (
              <DropdownMenuItem
                className="text-rose-600 focus:text-rose-700"
                onSelect={() => {
                  setDeleteError(null)
                  setIsDeleteDialogOpen(true)
                }}
              >
                <Trash2Icon className="size-4" />
                Delete Current Project
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AddProjectModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onCreated={handleProjectCreated}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Remove <span className="font-medium">{activeProject?.name ?? "this project"}</span> from Harbor.
              This does not delete files from disk.
            </DialogDescription>
          </DialogHeader>

          <div className="text-muted-foreground rounded-md border px-3 py-2 text-sm">
            {activeProject?.path ?? "Project path unavailable."}
          </div>

          {deleteError ? (
            <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {deleteError}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteProjectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleDeleteProject()
              }}
              disabled={!activeProject || deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
