import { redirect } from "next/navigation"

type ProjectDocsRedirectPageProps = {
  params: Promise<{
    project_id: string
  }>
}

export default async function ProjectDocsRedirectPage(
  props: ProjectDocsRedirectPageProps,
) {
  const { project_id: projectId } = await props.params
  redirect(`/${projectId}/review`)
}
