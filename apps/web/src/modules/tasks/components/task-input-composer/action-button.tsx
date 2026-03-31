"use client"

import { ArrowUpIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ActionButtonProps = {
  mode: "send" | "break"
  disabled?: boolean
  onClick?: () => void
}

export function ActionButton({
  mode,
  disabled = false,
  onClick,
}: ActionButtonProps) {
  const isBreak = mode === "break"

  return (
    <Button
      type="button"
      size="icon"
      className={cn(
        "size-10 shrink-0 rounded-lg bg-background text-foreground shadow-none transition-colors",
        isBreak
          ? "hover:bg-rose-500/10 hover:text-rose-700"
          : "hover:bg-muted/48",
      )}
      disabled={disabled}
      onClick={onClick}
      aria-label={isBreak ? "Stop current task turn" : "Send message"}
    >
      {isBreak ? (
        <span className="size-4 rounded-[3px] bg-current" />
      ) : (
        <ArrowUpIcon className="size-5" />
      )}
    </Button>
  )
}
