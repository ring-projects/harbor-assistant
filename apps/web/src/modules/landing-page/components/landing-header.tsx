import { ThemeToggle } from "@/components/theme-toggle"
import { HarborLogo } from "@/components/logo"
import { cn } from "@/lib/utils"

type LandingHeaderProps = {
  compact: boolean
}

export function LandingHeader({ compact }: LandingHeaderProps) {
  return (
    <header
      className={cn(
        "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        compact
          ? "mt-0 py-2 md:py-4"
          : "mt-10 border-b border-transparent py-8 md:py-10",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <HarborLogo
          className={cn(
            "origin-left transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            compact
              ? "w-45 translate-y-0 scale-100"
              : "w-90 translate-y-2 scale-100 md:w-105",
          )}
        />
        <ThemeToggle className="shrink-0" />
      </div>
    </header>
  )
}
