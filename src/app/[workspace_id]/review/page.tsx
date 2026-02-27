import { normalizeReviewListMode } from "@/components/review/utils"
import { ReviewWorkbench } from "@/components/review/workbench"
import {
  listReviewFiles,
  readReviewFile,
  ReviewServiceError,
} from "@/services/review/review.service"
import { getWorkspaceById } from "@/services/workspace/workspace.repository"

type WorkspaceReviewPageProps = {
  params: Promise<{
    workspace_id: string
  }>
  searchParams: Promise<{
    mode?: string | string[]
    file?: string | string[]
  }>
}

export default async function WorkspaceReviewPage(
  props: WorkspaceReviewPageProps,
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

  const modeRaw = Array.isArray(searchParams.mode)
    ? searchParams.mode[0]
    : searchParams.mode
  const mode = normalizeReviewListMode(modeRaw)
  const reviewFiles = await listReviewFiles({
    workspacePath: workspace.path,
    mode,
  })

  const selectedFileParam = Array.isArray(searchParams.file)
    ? searchParams.file[0]
    : searchParams.file
  const selectedRelativePath =
    selectedFileParam && selectedFileParam.trim()
      ? selectedFileParam
      : (reviewFiles.files[0]?.relativePath ?? null)
  const selectedFile = selectedRelativePath
    ? (reviewFiles.files.find(
        (file) => file.relativePath === selectedRelativePath,
      ) ?? null)
    : null

  let filePreview: Awaited<ReturnType<typeof readReviewFile>> | null = null
  let previewError: string | null = null
  if (selectedRelativePath) {
    try {
      filePreview = await readReviewFile({
        workspacePath: workspace.path,
        relativePath: selectedRelativePath,
      })
    } catch (error) {
      previewError =
        error instanceof ReviewServiceError
          ? error.message
          : "Failed to load file preview."
    }
  }

  return (
    <div className="bg-muted/30 flex flex-1 flex-col p-4 md:p-6">
      <ReviewWorkbench
        workspaceId={workspaceId}
        mode={mode}
        reviewFiles={reviewFiles}
        selectedRelativePath={selectedRelativePath}
        selectedFile={selectedFile}
        filePreview={filePreview}
        previewError={previewError}
      />
    </div>
  )
}
