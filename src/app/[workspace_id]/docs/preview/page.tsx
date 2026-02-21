import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { MarkdownPreview } from "@/components/documents/preview"
import {
  DocumentServiceError,
  readMarkdownDocument,
} from "@/services/documents/document.service"
import { getWorkspaceById } from "@/services/workspace/workspace.repository"

type WorkspaceDocPreviewPageProps = {
  params: Promise<{
    workspace_id: string
  }>
  searchParams: Promise<{
    file?: string | string[]
  }>
}

export default async function WorkspaceDocPreviewPage(
  props: WorkspaceDocPreviewPageProps
) {
  const [{ workspace_id: workspaceId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const workspace = await getWorkspaceById(workspaceId)

  if (!workspace) {
    return (
      <div className="bg-muted/30 flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <section className="bg-card text-card-foreground rounded-xl border p-5">
          <p className="text-muted-foreground text-sm">Workspace not found</p>
          <p className="mt-2 font-mono text-sm">{workspaceId}</p>
        </section>
      </div>
    )
  }

  const selectedRelativePathParam = Array.isArray(searchParams.file)
    ? searchParams.file[0]
    : searchParams.file
  const selectedRelativePath =
    selectedRelativePathParam && selectedRelativePathParam.trim()
      ? selectedRelativePathParam
      : null

  if (!selectedRelativePath) {
    return (
      <div className="bg-muted/30 flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <section className="bg-card text-card-foreground rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <Link
              href={`/${workspaceId}/docs`}
              className="hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm"
            >
              <ArrowLeftIcon className="size-4" />
              Back
            </Link>
            <p className="text-muted-foreground text-sm">No document selected.</p>
          </div>
        </section>
      </div>
    )
  }

  let markdownContent: string | null = null
  let previewError: string | null = null
  try {
    const readResult = await readMarkdownDocument({
      rootPath: workspace.path,
      relativePath: selectedRelativePath,
    })
    markdownContent = readResult.content
  } catch (error) {
    previewError =
      error instanceof DocumentServiceError
        ? error.message
        : "Failed to load markdown preview."
  }

  return (
    <div className="bg-muted/30 flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <section className="bg-card text-card-foreground rounded-xl border p-3">
        <div className="mb-3 flex items-center gap-3 border-b pb-3">
          <Link
            href={`/${workspaceId}/docs`}
            className="hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm"
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </Link>
          <p className="text-muted-foreground truncate font-mono text-sm">
            {selectedRelativePath}
          </p>
        </div>

        {previewError ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {previewError}
          </div>
        ) : markdownContent ? (
          <MarkdownPreview content={markdownContent} />
        ) : (
          <p className="text-muted-foreground text-sm">
            Unable to render markdown preview.
          </p>
        )}
      </section>
    </div>
  )
}
