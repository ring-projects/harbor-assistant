"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { useIsClient } from "@/hooks/use-is-client"
import { cn } from "@/lib/utils"

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const isClient = useIsClient()
  const isDark = resolvedTheme === "dark"
  const label = isDark ? "Switch to white theme" : "Switch to black theme"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("relative", className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      {isClient ? (
        <>
          <SunIcon className="size-4 scale-100 transition-all duration-300 ease-in-out dark:scale-0" />
          <MoonIcon className="absolute size-4 scale-0 transition-all duration-300 ease-in-out dark:scale-100" />
          <span className="sr-only">{label}</span>
        </>
      ) : (
        <>
          <span className="size-4" aria-hidden="true" />
          <span className="sr-only">Toggle theme</span>
        </>
      )}
    </Button>
  )
}
