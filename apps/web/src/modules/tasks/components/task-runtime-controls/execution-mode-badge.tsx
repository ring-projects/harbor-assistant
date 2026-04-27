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
        "bg-background/35 text-foreground/80 inline-flex h-8 items-center gap-2 rounded-md px-3 font-mono text-[11px] font-medium",
        className,
      )}
    >
      <WifiIcon className="text-muted-foreground size-3.5" />
      <span>{formatExecutionModeLabel(value ?? "connected")}</span>
    </span>
  )
}
