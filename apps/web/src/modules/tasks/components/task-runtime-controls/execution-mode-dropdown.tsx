"use client"

import { ChevronDownIcon, WifiIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  TASK_EXECUTION_MODE_VALUES,
  type TaskExecutionMode,
} from "@/modules/tasks/contracts"
import { formatExecutionModeLabel } from "@/modules/tasks/view-models"

const EXECUTION_MODE_OPTIONS: Array<{
  value: TaskExecutionMode
  label: string
}> = [
  {
    value: "safe",
    label: "Safe",
  },
  {
    value: "connected",
    label: "Normal",
  },
  {
    value: "full-access",
    label: "Full Access",
  },
]

const EXECUTION_MODE_SET = new Set<TaskExecutionMode>(TASK_EXECUTION_MODE_VALUES)

type ExecutionModeDropdownProps = {
  disabled?: boolean
  value: TaskExecutionMode
  onValueChange: (value: TaskExecutionMode) => void
}

export function ExecutionModeDropdown({
  disabled = false,
  value,
  onValueChange,
}: ExecutionModeDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-full border-border/70 bg-background/80 px-3 text-xs font-medium shadow-none"
          disabled={disabled}
        >
          <WifiIcon className="size-3.5" />
          <span>{formatExecutionModeLabel(value)}</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 rounded-2xl p-2">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Execution Mode
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(nextValue) => {
            if (EXECUTION_MODE_SET.has(nextValue as TaskExecutionMode)) {
              onValueChange(nextValue as TaskExecutionMode)
            }
          }}
        >
          {EXECUTION_MODE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
