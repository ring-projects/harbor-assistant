"use client"

import Link from "next/link"

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import type { TopNavItem } from "./types"
import { buildSectionHref, isSectionActive } from "./utils"

type TopNavMainProps = {
  pathname: string
  workspaceId: string | null
  items: TopNavItem[]
}

export function TopNavMain(props: TopNavMainProps) {
  const { pathname, workspaceId, items } = props

  return (
    <div className="min-w-0 flex-1 overflow-x-auto">
      <NavigationMenu viewport={false} className="w-full justify-start">
        <NavigationMenuList className="justify-start gap-1">
          {items.map((item) => {
            const href = buildSectionHref(item.key, workspaceId)
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
  )
}
