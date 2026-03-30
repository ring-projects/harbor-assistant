"use client"

import { WifiIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatExecutionModeLabel } from "@/modules/tasks/view-models"

type ExecutionModeBadgeProps = {
  className?: string
  value: string | null | undefined
}

export function ExecutionModeBadge({
  className,
  value,
}: ExecutionModeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md bg-background/35 px-3 font-mono text-[11px] font-medium text-foreground/80",
        className,
      )}
    >
      <WifiIcon className="size-3.5 text-muted-foreground" />
      <span>{formatExecutionModeLabel(value ?? "connected")}</span>
    </span>
  )
}
