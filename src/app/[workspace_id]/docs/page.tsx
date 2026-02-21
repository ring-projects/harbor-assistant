import Link from "next/link"
import { FileTextIcon, FolderSearch2Icon } from "lucide-react"

import {
  DocumentServiceError,
  listMarkdownDocuments,
} from "@/services/documents/document.service"
import { getWorkspaceById } from "@/services/workspace/workspace.repository"

type WorkspaceDocsPageProps = {
  params: Promise<{
    workspace_id: string
  }>
}

export default async function WorkspaceDocsPage(props: WorkspaceDocsPageProps) {
  const { workspace_id: workspaceId } = await props.params
  const workspace = await getWorkspaceById(workspaceId)

  if (!workspace) {
    return (
      <div className="bg-muted/30 flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <section className="bg-card text-card-foreground rounded-xl border p-5">
          <p className="text-muted-foreground text-sm">Workspace</p>
          <h1 className="mt-2 text-2xl font-semibold">Documents</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Workspace not found: <span className="font-mono">{workspaceId}</span>
          </p>
        </section>
      </div>
    )
  }

  let listResult: Awaited<ReturnType<typeof listMarkdownDocuments>> | null = null
  let errorMessage: string | null = null

  try {
    listResult = await listMarkdownDocuments({
      rootPath: workspace.path,
    })
  } catch (error) {
    errorMessage =
      error instanceof DocumentServiceError
        ? error.message
        : "Failed to load markdown documents."
  }

  return (
    <div className="bg-muted/30 flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <section className="bg-card text-card-foreground rounded-xl border p-3">
        {errorMessage ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {errorMessage}
          </div>
        ) : (
          <aside className="border-border space-y-2 rounded-lg border p-2">
            {listResult && listResult.documents.length > 0 ? (
              <ul className="max-h-[70vh] space-y-1 overflow-auto">
                {listResult.documents.map((document) => (
                  <li key={document.absolutePath}>
                    <Link
                      href={`/${workspaceId}/docs/preview?file=${encodeURIComponent(document.relativePath)}`}
                      className="hover:bg-muted/60 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                    >
                      <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate font-mono">
                        {document.relativePath}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground flex items-center gap-2 px-2 py-6 text-sm">
                <FolderSearch2Icon className="size-4 shrink-0" />
                No markdown files found.
              </div>
            )}

            {listResult?.truncated ? (
              <p className="text-muted-foreground px-2 text-xs">
                Result truncated after {listResult.documents.length} files.
              </p>
            ) : null}
          </aside>
        )}
      </section>
    </div>
  )
}
