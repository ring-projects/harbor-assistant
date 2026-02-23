"use client"

import Link from "next/link"
import { SettingsIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

export function TopNavActions() {
  const pathname = usePathname()

  return (
    <div className="ml-auto flex items-center gap-2">
      <Link
        href="/settings"
        className={cn(
          "hover:bg-muted inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm",
          pathname === "/settings" && "bg-accent",
        )}
      >
        <SettingsIcon className="size-4" />
      </Link>
    </div>
  )
}
