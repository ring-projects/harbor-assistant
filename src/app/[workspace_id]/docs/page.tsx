import { redirect } from "next/navigation"

type WorkspaceDocsRedirectPageProps = {
  params: Promise<{
    workspace_id: string
  }>
}

export default async function WorkspaceDocsRedirectPage(
  props: WorkspaceDocsRedirectPageProps
) {
  const { workspace_id: workspaceId } = await props.params
  redirect(`/${workspaceId}/review`)
}
