import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { listProjectsFromService } from "@/lib/projects-service"
import { ProjectsList } from "@/modules/projects/components"

type ProjectShellLayoutProps = {
  children: React.ReactNode
}

export default async function ProjectShellLayout({
  children,
}: ProjectShellLayoutProps) {
  const initialProjects = await listProjectsFromService()

  return (
    <SidebarProvider defaultOpen className="bg-background min-h-svh">
      <Sidebar variant="sidebar" collapsible="offcanvas">
        <ProjectsList initialProjects={initialProjects} />
      </Sidebar>

      <SidebarInset className="min-h-svh">{children}</SidebarInset>
    </SidebarProvider>
  )
}
