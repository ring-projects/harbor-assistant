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
        "size-10 shrink-0 rounded-full shadow-none transition-colors",
        isBreak
          ? "bg-background text-foreground hover:bg-surface-danger hover:text-destructive"
          : disabled
            ? "bg-background text-foreground"
            : "bg-primary text-primary-foreground hover:bg-[#302c2c] active:bg-[#201d1d]",
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
