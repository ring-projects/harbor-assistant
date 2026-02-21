"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDownIcon, FolderKanbanIcon, PlusIcon } from "lucide-react";

import { LogoMark } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores";

export function AppSidebarHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const workspaces = useWorkspaceStore((store) => store.workspaces);
  const activeWorkspaceId = useWorkspaceStore(
    (store) => store.activeWorkspaceId,
  );
  const setActiveWorkspace = useWorkspaceStore(
    (store) => store.setActiveWorkspace,
  );
  const ensureWorkspacesLoaded = useWorkspaceStore(
    (store) => store.ensureWorkspacesLoaded,
  );
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    void ensureWorkspacesLoaded();
  }, [ensureWorkspacesLoaded]);

  const activeWorkspace = useMemo(
    () =>
      workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
      workspaces[0] ??
      null,
    [activeWorkspaceId, workspaces],
  );

  const handleSelectWorkspace = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);

    if (pathname.includes("/mcp")) {
      router.push(`/${workspaceId}/mcp`);
      return;
    }

    if (pathname.includes("/skills")) {
      router.push(`/${workspaceId}/skills`);
      return;
    }

    router.push(`/${workspaceId}/docs`);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={switcherOpen} onOpenChange={setSwitcherOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-accent-foreground text-sidebar flex aspect-square size-8 items-center justify-center rounded-lg">
                <LogoMark className="size-5" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Otter Assistant</span>
                <span className="text-muted-foreground truncate text-xs">
                  {activeWorkspace?.name ?? "No workspace"}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="right"
            sideOffset={8}
            className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-2xl p-2"
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Workspace
            </DropdownMenuLabel>

            {workspaces.length === 0 ? (
              <DropdownMenuItem disabled>No workspaces yet.</DropdownMenuItem>
            ) : (
              workspaces.slice(0, 9).map((workspace, index) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onSelect={() => handleSelectWorkspace(workspace.id)}
                  className={cn(
                    "gap-3 rounded-lg py-2",
                    workspace.id === activeWorkspace?.id && "bg-accent",
                  )}
                >
                  <div className="bg-muted border-border flex size-8 shrink-0 items-center justify-center rounded-lg border">
                    <FolderKanbanIcon className="size-4" />
                  </div>
                  <span className="flex-1 truncate">{workspace.name}</span>
                  <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                </DropdownMenuItem>
              ))
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <PlusIcon />
                <span>Add team</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
