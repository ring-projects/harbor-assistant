import { ProjectSettingsView } from "@/modules/settings"

type ProjectSettingsPageProps = {
  params: Promise<{
    project_id: string
  }>
}

export default async function ProjectSettingsPage(props: ProjectSettingsPageProps) {
  const { project_id: projectId } = await props.params

  return (
    <div className="h-svh min-h-0 overflow-hidden">
      <ProjectSettingsView projectId={projectId} />
    </div>
  )
}
