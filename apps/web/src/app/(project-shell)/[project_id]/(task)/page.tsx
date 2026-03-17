import { listProjectsFromService } from "@/lib/projects-service"
import { ProjectClient } from "./project-client"

type ProjectTaskPageProps = {
  params: Promise<{
    project_id: string
  }>
}

export default async function ProjectTaskRoutePage(
  props: ProjectTaskPageProps,
) {
  const { project_id: projectId } = await props.params
  const initialProjects = await listProjectsFromService()

  return (
    <ProjectClient
      projectId={projectId}
      initialProjects={initialProjects}
    />
  )
}
