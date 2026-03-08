import { SidebarTrigger } from "@/components/ui/sidebar"
import { ProjectStoreProvider } from "@/modules/projects/providers"
import { TaskWorkbench } from "@/modules/tasks"

type ProjectProgressPageProps = {
  params: Promise<{
    project_id: string
  }>
}

export default async function ProjectProgressRoutePage(
  props: ProjectProgressPageProps,
) {
  const { project_id: projectId } = await props.params

  return (
    <ProjectStoreProvider key={projectId} projectId={projectId}>
      <div className="flex h-svh min-h-0 flex-col overflow-hidden">
        <header className="flex h-12 items-center border-b px-3">
          <SidebarTrigger />
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          <TaskWorkbench projectId={projectId} />
        </div>
      </div>
    </ProjectStoreProvider>
  )
}
