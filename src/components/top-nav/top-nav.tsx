"use client"

import { usePathname } from "next/navigation"
import { useMemo } from "react"

import { Separator } from "@/components/ui/separator"
import { useWorkspaceStore } from "@/stores"
import { TopNavActions } from "./actions"
import { NAV_ITEMS } from "./constants"
import { extractWorkspaceIdFromPath } from "./utils"
import { WorkspaceSwitcher } from "./workspace-switcher"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { buildSectionHref, isSectionActive } from "./utils"
import Link from "next/link"

export function AppTopNav() {
  const pathname = usePathname()
  const activeWorkspaceId = useWorkspaceStore(
    (store) => store.activeWorkspaceId,
  )

  const pathnameWorkspaceId = useMemo(
    () => extractWorkspaceIdFromPath(pathname),
    [pathname],
  )
  const effectiveWorkspaceId = activeWorkspaceId ?? pathnameWorkspaceId

  return (
    <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <WorkspaceSwitcher />
        <Separator orientation="vertical" className="hidden h-6 md:block" />
        <div className="min-w-0 flex-1 overflow-x-auto">
          <NavigationMenu viewport={false} className="w-full justify-start">
            <NavigationMenuList className="justify-start gap-1">
              {NAV_ITEMS.map((item) => {
                const href = buildSectionHref(item.key, effectiveWorkspaceId)
                const active = isSectionActive(pathname, href)

                return (
                  <NavigationMenuItem key={item.key}>
                    <NavigationMenuLink
                      asChild
                      active={active}
                      className="flex-row items-center gap-2 px-3 py-1.5"
                    >
                      <Link href={href}>
                        <item.icon className="size-4" />
                        <span className="whitespace-nowrap">{item.label}</span>
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                )
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <TopNavActions />
      </div>
    </header>
  )
}
