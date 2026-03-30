"use client"

import { ChevronDownIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  TASK_EFFORT_VALUES,
  type TaskEffort,
} from "@/modules/tasks/contracts"
import { formatEffortLabel } from "@/modules/tasks/view-models"

const EFFORT_SET = new Set<TaskEffort>(TASK_EFFORT_VALUES)

type EffortDropdownProps = {
  buttonClassName?: string
  defaultOptionLabel?: string
  disabled?: boolean
  efforts: readonly TaskEffort[]
  value: TaskEffort | null
  onValueChange: (value: TaskEffort | null) => void
}

export function EffortDropdown({
  buttonClassName,
  defaultOptionLabel,
  disabled = false,
  efforts,
  value,
  onValueChange,
}: EffortDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-9 rounded-full border-border/70 bg-background/80 px-3 text-xs font-medium shadow-none",
            buttonClassName,
          )}
          disabled={disabled}
        >
          <SparklesIcon className="size-3.5" />
          <span>{formatEffortLabel(value)}</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 rounded-2xl p-2">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Effort
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value ?? ""}
          onValueChange={(nextValue) => {
            if (nextValue === "") {
              onValueChange(null)
              return
            }

            if (EFFORT_SET.has(nextValue as TaskEffort)) {
              onValueChange(nextValue as TaskEffort)
            }
          }}
        >
          {defaultOptionLabel ? (
            <>
              <DropdownMenuRadioItem value="">{defaultOptionLabel}</DropdownMenuRadioItem>
              {efforts.length > 0 ? <DropdownMenuSeparator /> : null}
            </>
          ) : null}
          {efforts.map((effort) => (
            <DropdownMenuRadioItem key={effort} value={effort}>
              {formatEffortLabel(effort)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
