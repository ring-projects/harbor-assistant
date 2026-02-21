"use client";

import { usePathname } from "next/navigation";

import { AppSidebarContent } from "@/components/app-sidebar/content";
import { AppSidebarFooter } from "@/components/app-sidebar/footer";
import { AppSidebarHeader } from "@/components/app-sidebar/header";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <AppSidebarHeader />
      </SidebarHeader>

      <SidebarContent>
        <AppSidebarContent pathname={pathname} />
      </SidebarContent>

      <SidebarFooter>
        <AppSidebarFooter />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
