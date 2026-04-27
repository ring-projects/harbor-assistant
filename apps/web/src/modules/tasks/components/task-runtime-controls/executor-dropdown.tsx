"use client"

import { BotIcon, ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatExecutorLabel } from "@/modules/tasks/view-models"
import type { TaskCreationExecutor } from "@/stores/app.store"

const EXECUTOR_OPTIONS: Array<{
  value: TaskCreationExecutor
  label: string
}> = [
  {
    value: "codex",
    label: "Codex",
  },
  {
    value: "claude-code",
    label: "Claude Code",
  },
]

type ExecutorDropdownProps = {
  disabled?: boolean
  value: TaskCreationExecutor
  onValueChange: (value: string) => void
}

export function ExecutorDropdown({
  disabled = false,
  value,
  onValueChange,
}: ExecutorDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-border/70 bg-background/80 h-9 rounded-full px-3 text-xs font-medium shadow-none"
          disabled={disabled}
        >
          <BotIcon className="size-3.5" />
          <span className="max-w-36 truncate">
            {formatExecutorLabel(value)}
          </span>
          <ChevronDownIcon className="text-muted-foreground size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 rounded-2xl p-2">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Executor
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {EXECUTOR_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
