"use client"

import { ThemeToggle } from "@/modules/app"
import { CurrentProjectName } from "@/modules/projects/components"

export function ProjectHeader() {
  return (
    <div>
      <header className="border-border/60 flex h-14 items-center justify-between gap-3 border-b px-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <CurrentProjectName />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>
    </div>
  )
}
