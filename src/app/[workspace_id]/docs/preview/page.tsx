import { redirect } from "next/navigation"

type WorkspaceDocsPreviewRedirectPageProps = {
  params: Promise<{
    workspace_id: string
  }>
  searchParams: Promise<{
    file?: string | string[]
  }>
}

export default async function WorkspaceDocsPreviewRedirectPage(
  props: WorkspaceDocsPreviewRedirectPageProps
) {
  const [{ workspace_id: workspaceId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const fileParam = Array.isArray(searchParams.file)
    ? searchParams.file[0]
    : searchParams.file

  const nextUrl = fileParam?.trim()
    ? `/${workspaceId}/review?file=${encodeURIComponent(fileParam)}`
    : `/${workspaceId}/review`
  redirect(nextUrl)
}
