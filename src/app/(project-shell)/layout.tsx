import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ProjectsList } from "@/modules/projects/components"
import { listProjects } from "@/services/project/project.repository"

type ProjectShellLayoutProps = {
  children: React.ReactNode
}

export default async function ProjectShellLayout({
  children,
}: ProjectShellLayoutProps) {
  const initialProjects = await listProjects()

  return (
    <SidebarProvider defaultOpen className="bg-background min-h-svh">
      <Sidebar variant="sidebar" collapsible="offcanvas">
        <ProjectsList initialProjects={initialProjects} />
      </Sidebar>

      <SidebarInset className="min-h-svh">{children}</SidebarInset>
    </SidebarProvider>
  )
}
