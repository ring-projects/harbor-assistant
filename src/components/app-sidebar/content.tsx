"use client";

import Link from "next/link";
import { BookOpenIcon, CableIcon, SparklesIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useWorkspaceStore } from "@/stores";

type AppSidebarContentProps = {
  pathname: string;
};

export function AppSidebarContent(props: AppSidebarContentProps) {
  const { pathname } = props;
  const activeWorkspaceId = useWorkspaceStore(
    (store) => store.activeWorkspaceId,
  );

  const docsUrl = activeWorkspaceId ? `/${activeWorkspaceId}/docs` : "/settings";
  const skillsUrl = activeWorkspaceId
    ? `/${activeWorkspaceId}/skills`
    : "/settings";
  const mcpUrl = activeWorkspaceId ? `/${activeWorkspaceId}/mcp` : "/settings";

  const docsActive = activeWorkspaceId
    ? pathname === docsUrl || pathname.startsWith(`${docsUrl}/`)
    : pathname === "/settings";
  const skillsActive = activeWorkspaceId
    ? pathname === skillsUrl || pathname.startsWith(`${skillsUrl}/`)
    : pathname === "/settings";
  const mcpActive = activeWorkspaceId
    ? pathname === mcpUrl || pathname.startsWith(`${mcpUrl}/`)
    : pathname === "/settings";

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Documents</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={docsActive} tooltip="Documents">
                <Link href={docsUrl}>
                  <BookOpenIcon />
                  <span>Docs</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Skills</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={skillsActive} tooltip="Skills">
                <Link href={skillsUrl}>
                  <SparklesIcon />
                  <span>Skills</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={mcpActive} tooltip="MCP">
                <Link href={mcpUrl}>
                  <CableIcon />
                  <span>MCP</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
