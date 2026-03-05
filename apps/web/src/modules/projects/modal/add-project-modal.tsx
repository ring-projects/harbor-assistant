"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CreateProject } from "@/modules/projects/components/create-project"
import type { Project } from "@/services/project/types"

type AddProjectModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (projects: Project[]) => void
}

export function AddProjectModal({
  open,
  onOpenChange,
  onCreated,
}: AddProjectModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Add Project</DialogTitle>
          <DialogDescription>
            Select a local folder and create a new project workspace.
          </DialogDescription>
        </DialogHeader>
        <CreateProject
          className="rounded-none border-0"
          pickerTitle={null}
          onCancel={() => onOpenChange(false)}
          onCreated={(projects) => {
            onOpenChange(false)
            onCreated?.(projects)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
