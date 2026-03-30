"use client"

import { cn } from "@/lib/utils"
import { formatExecutorLabel } from "@/modules/tasks/view-models"

type ExecutorBadgeProps = {
  className?: string
  value: string | null | undefined
}

export function ExecutorBadge({ className, value }: ExecutorBadgeProps) {
  if (!value) {
    return null
  }

  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md bg-background/35 px-3 font-mono text-[11px] font-medium text-foreground/80",
        className,
      )}
    >
      <span>{formatExecutorLabel(value)}</span>
    </span>
  )
}
