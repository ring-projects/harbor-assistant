"use client"

import { ChevronDownIcon, Settings2Icon } from "lucide-react"

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
import { formatModelSummary } from "@/modules/tasks/view-models"

type ModelOption = {
  id: string
  displayName: string
  isDefault: boolean
}

type ModelDropdownProps = {
  buttonClassName?: string
  defaultOptionLabel?: string
  disabled?: boolean
  executor: string
  models: ModelOption[]
  value: string | null
  onValueChange: (value: string | null) => void
}

export function ModelDropdown({
  buttonClassName,
  defaultOptionLabel,
  disabled = false,
  executor,
  models,
  value,
  onValueChange,
}: ModelDropdownProps) {
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
          <Settings2Icon className="size-3.5" />
          <span className="max-w-52 truncate">{formatModelSummary(value)}</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 rounded-2xl p-2">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Model
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value ?? ""}
          onValueChange={(nextValue) => {
            onValueChange(nextValue || null)
          }}
        >
          {defaultOptionLabel ? (
            <>
              <DropdownMenuRadioItem value="">{defaultOptionLabel}</DropdownMenuRadioItem>
              {models.length > 0 ? <DropdownMenuSeparator /> : null}
            </>
          ) : null}
          {models.map((model) => (
            <DropdownMenuRadioItem key={`${executor}:${model.id}`} value={model.id}>
              {model.isDefault
                ? `${model.displayName} (${model.id}, default)`
                : `${model.displayName} (${model.id})`}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
