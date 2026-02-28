import { redirect } from "next/navigation"

type ProjectDocsPreviewRedirectPageProps = {
  params: Promise<{
    project_id: string
  }>
  searchParams: Promise<{
    file?: string | string[]
  }>
}

export default async function ProjectDocsPreviewRedirectPage(
  props: ProjectDocsPreviewRedirectPageProps,
) {
  const [{ project_id: projectId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const fileParam = Array.isArray(searchParams.file)
    ? searchParams.file[0]
    : searchParams.file

  const nextUrl = fileParam?.trim()
    ? `/${projectId}/review?file=${encodeURIComponent(fileParam)}`
    : `/${projectId}/review`
  redirect(nextUrl)
}
