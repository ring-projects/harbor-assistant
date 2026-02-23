"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"

import { Separator } from "@/components/ui/separator"
import { useWorkspaceStore } from "@/stores"
import { TopNavActions } from "./actions"
import { NAV_ITEMS } from "./constants"
import { TopNavMain } from "./main-nav"
import { extractWorkspaceIdFromPath, resolveCurrentSection } from "./utils"
import { WorkspaceSwitcher } from "./workspace-switcher"

export function AppTopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const workspaces = useWorkspaceStore((store) => store.workspaces)
  const activeWorkspaceId = useWorkspaceStore(
    (store) => store.activeWorkspaceId
  )
  const setActiveWorkspace = useWorkspaceStore(
    (store) => store.setActiveWorkspace
  )
  const ensureWorkspacesLoaded = useWorkspaceStore(
    (store) => store.ensureWorkspacesLoaded
  )

  useEffect(() => {
    void ensureWorkspacesLoaded()
  }, [ensureWorkspacesLoaded])

  const pathnameWorkspaceId = useMemo(
    () => extractWorkspaceIdFromPath(pathname),
    [pathname]
  )
  const effectiveWorkspaceId = activeWorkspaceId ?? pathnameWorkspaceId

  const activeWorkspace = useMemo(
    () =>
      workspaces.find((workspace) => workspace.id === effectiveWorkspaceId) ??
      workspaces[0] ??
      null,
    [effectiveWorkspaceId, workspaces]
  )

  const onSelectWorkspace = (workspaceId: string) => {
    setActiveWorkspace(workspaceId)
    const section = resolveCurrentSection(pathname)
    router.push(`/${workspaceId}/${section}`)
  }

  return (
    <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          onSelectWorkspace={onSelectWorkspace}
        />
        <Separator orientation="vertical" className="hidden h-6 md:block" />
        <TopNavMain
          pathname={pathname}
          workspaceId={effectiveWorkspaceId}
          items={NAV_ITEMS}
        />
        <TopNavActions pathname={pathname} />
      </div>
    </header>
  )
}
