"use client"

import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type PendingTaskDelete = {
  taskId: string
  title: string
}

type DeleteTaskDialogProps = {
  errorMessage?: string | null
  isDeleting?: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  pendingTaskDelete: PendingTaskDelete | null
}

export function DeleteTaskDialog({
  errorMessage = null,
  isDeleting = false,
  onConfirm,
  onOpenChange,
  pendingTaskDelete,
}: DeleteTaskDialogProps) {
  return (
    <Dialog open={Boolean(pendingTaskDelete)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Task</DialogTitle>
          <DialogDescription>
            Delete &quot;{pendingTaskDelete?.title ?? "this task"}&quot;
            permanently? This also removes its event history from Harbor.
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <Trash2Icon className="size-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
