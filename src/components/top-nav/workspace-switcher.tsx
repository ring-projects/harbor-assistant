"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronsUpDownIcon, FolderKanbanIcon, PlusIcon } from "lucide-react"

import { LogoMark } from "@/components/logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Workspace } from "@/services/workspace/types"

type WorkspaceSwitcherProps = {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  onSelectWorkspace: (workspaceId: string) => void
}

export function WorkspaceSwitcher(props: WorkspaceSwitcherProps) {
  const { workspaces, activeWorkspace, onSelectWorkspace } = props
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted inline-flex max-w-[320px] items-center gap-2 rounded-md px-2 py-1.5 text-left"
        >
          <div className="bg-muted border-border flex size-8 items-center justify-center rounded-lg border">
            <LogoMark className="size-5" />
          </div>
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-medium">Otter Assistant</span>
            <span className="text-muted-foreground truncate text-xs">
              {activeWorkspace?.name ?? "No workspace"}
            </span>
          </div>
          <ChevronsUpDownIcon className="text-muted-foreground size-4 shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[320px] p-2">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Workspace
        </DropdownMenuLabel>
        {workspaces.length === 0 ? (
          <DropdownMenuItem disabled>No workspaces yet.</DropdownMenuItem>
        ) : (
          workspaces.slice(0, 9).map((workspace, index) => (
            <DropdownMenuItem
              key={workspace.id}
              onSelect={() => onSelectWorkspace(workspace.id)}
              className={cn(
                "gap-3 rounded-md py-2",
                workspace.id === activeWorkspace?.id && "bg-accent"
              )}
            >
              <div className="bg-muted border-border flex size-8 shrink-0 items-center justify-center rounded-md border">
                <FolderKanbanIcon className="size-4" />
              </div>
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <PlusIcon className="size-4" />
            <span>Add workspace</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
