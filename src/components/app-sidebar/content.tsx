"use client";

import Link from "next/link";
import {
  BotIcon,
  CableIcon,
  SparklesIcon,
  SquareCheckBigIcon,
} from "lucide-react";

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

  const reviewUrl = activeWorkspaceId ? `/${activeWorkspaceId}/review` : "/settings";
  const skillsUrl = activeWorkspaceId
    ? `/${activeWorkspaceId}/skills`
    : "/settings";
  const mcpUrl = activeWorkspaceId ? `/${activeWorkspaceId}/mcp` : "/settings";
  const tasksUrl = activeWorkspaceId
    ? `/${activeWorkspaceId}/tasks`
    : "/settings";

  const reviewActive = activeWorkspaceId
    ? pathname === reviewUrl || pathname.startsWith(`${reviewUrl}/`)
    : pathname === "/settings";
  const skillsActive = activeWorkspaceId
    ? pathname === skillsUrl || pathname.startsWith(`${skillsUrl}/`)
    : pathname === "/settings";
  const mcpActive = activeWorkspaceId
    ? pathname === mcpUrl || pathname.startsWith(`${mcpUrl}/`)
    : pathname === "/settings";
  const tasksActive = activeWorkspaceId
    ? pathname === tasksUrl || pathname.startsWith(`${tasksUrl}/`)
    : pathname === "/settings";

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Review</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={reviewActive} tooltip="Code Review">
                <Link href={reviewUrl}>
                  <SquareCheckBigIcon />
                  <span>Code Review</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Automation</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={tasksActive} tooltip="Tasks">
                <Link href={tasksUrl}>
                  <BotIcon />
                  <span>Tasks</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
