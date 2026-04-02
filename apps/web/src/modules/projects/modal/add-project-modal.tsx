"use client"

import { useNavigate } from "@tanstack/react-router"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CreateProject } from "@/modules/projects/components/create-project"
import { useUiStore } from "@/stores/ui.store"

export function AddProjectModal() {
  const navigate = useNavigate()
  const open = useUiStore((state) => state.addProjectModalOpen)
  const closeAddProjectModal = useUiStore((state) => state.closeAddProjectModal)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeAddProjectModal()
        }
      }}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Add Project</DialogTitle>
          <DialogDescription>
            Register a server-local workspace or a git repository as a project.
          </DialogDescription>
        </DialogHeader>
        <CreateProject
          className="rounded-none border-0"
          pickerTitle={null}
          onCancel={closeAddProjectModal}
          onCreated={(project) => {
            closeAddProjectModal()
            void navigate({
              to: "/$projectId",
              params: {
                projectId: project.id,
              },
            })
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
