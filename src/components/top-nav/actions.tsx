"use client"

import Link from "next/link"
import { SettingsIcon } from "lucide-react"

import { FileExplorerSheet } from "@/components/file-explorer"
import { cn } from "@/lib/utils"

type TopNavActionsProps = {
  pathname: string
}

export function TopNavActions(props: TopNavActionsProps) {
  const { pathname } = props

  return (
    <div className="ml-auto flex items-center gap-2">
      <FileExplorerSheet />
      <Link
        href="/settings"
        className={cn(
          "hover:bg-muted inline-flex h-8 items-center gap-1 rounded-md border px-2 text-sm",
          pathname === "/settings" && "bg-accent"
        )}
      >
        <SettingsIcon className="size-4" />
        <span className="hidden sm:inline">Settings</span>
      </Link>
    </div>
  )
}
