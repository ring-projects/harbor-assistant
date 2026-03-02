import { ProjectStoreProvider } from "@/modules/projects/providers"

type ProjectLayoutProps = {
  children: React.ReactNode
  modal: React.ReactNode
  params: Promise<{
    project_id: string
  }>
}

export default async function ProjectLayout({
  children,
  modal,
  params,
}: ProjectLayoutProps) {
  const { project_id: projectId } = await params

  return (
    <ProjectStoreProvider key={projectId} projectId={projectId}>
      {children}
      {modal}
    </ProjectStoreProvider>
  )
}
