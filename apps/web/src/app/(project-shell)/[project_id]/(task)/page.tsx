import { ProjectTaskWorkspace } from "./project-task-workspace"

type ProjectTaskPageProps = {
  params: Promise<{
    project_id: string
  }>
}

export default async function ProjectTaskRoutePage(
  props: ProjectTaskPageProps,
) {
  const { project_id: projectId } = await props.params

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ProjectTaskWorkspace projectId={projectId} />
    </div>
  )
}
