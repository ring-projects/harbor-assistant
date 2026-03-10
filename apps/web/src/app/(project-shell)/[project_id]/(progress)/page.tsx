import { ProjectProgressWorkspace } from "./project-progress-workspace"

type ProjectProgressPageProps = {
  params: Promise<{
    project_id: string
  }>
}

export default async function ProjectProgressRoutePage(
  props: ProjectProgressPageProps,
) {
  const { project_id: projectId } = await props.params

  return <ProjectProgressWorkspace projectId={projectId} />
}
