"use client"

import { FileTextIcon, ImageIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  getAttachmentDisplayName,
  type UploadedTaskInputImage,
} from "@/modules/tasks/lib"

type TaskInputAttachmentListProps = {
  attachments: UploadedTaskInputImage[]
  disabled?: boolean
  onRemove?: (path: string) => void
}

export function TaskInputAttachmentList({
  attachments,
  disabled = false,
  onRemove,
}: TaskInputAttachmentListProps) {
  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.path}
          className="border-border/70 bg-background/75 text-foreground/85 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px]"
        >
          {attachment.mediaType.startsWith("image/") ? (
            <ImageIcon className="text-muted-foreground size-3.5" />
          ) : (
            <FileTextIcon className="text-muted-foreground size-3.5" />
          )}
          <span className="max-w-56 truncate">
            {getAttachmentDisplayName(attachment)}
          </span>
          <span className="text-muted-foreground/90">
            {Math.max(1, Math.round(attachment.size / 1024))} KB
          </span>
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-5 rounded-full"
              onClick={() => onRemove(attachment.path)}
              disabled={disabled}
              aria-label={`Remove ${getAttachmentDisplayName(attachment)}`}
            >
              <XIcon className="size-3" />
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  )
}
