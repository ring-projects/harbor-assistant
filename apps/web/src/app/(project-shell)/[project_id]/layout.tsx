import { listProjectsFromService } from "@/lib/projects-service"
import { ProjectSidebar } from "@/modules/projects"

type ProjectLayoutProps = {
  children: React.ReactNode
  params: Promise<{
    project_id: string
  }>
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { project_id: projectId } = await params
  const initialProjects = await listProjectsFromService()

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <ProjectSidebar
        projectId={projectId}
        initialProjects={initialProjects}
      />
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
