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
  id: string
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
            <span className="block">Delete</span>
            <span className="text-foreground line-clamp-2 block font-medium wrap-break-words">
              &quot;{pendingTaskDelete?.title ?? "this task"}&quot;
            </span>
            <span className="block">
              permanently? This also removes its event history from Harbor.
            </span>
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <div className="bg-surface-danger text-destructive rounded-md border border-destructive/25 p-2 text-xs">
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
