import Link from "next/link"
import { GitBranchIcon } from "lucide-react"

import { ReviewChangesPanel } from "@/components/review/changes-panel"
import { ReviewFilePanel } from "@/components/review/file-review-panel"
import {
  getReviewStatusStats,
  normalizeReviewListMode,
} from "@/components/review/utils"
import { cn } from "@/lib/utils"
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
  props: WorkspaceReviewPageProps
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
      : reviewFiles.files[0]?.relativePath ?? null
  const selectedFile = selectedRelativePath
    ? reviewFiles.files.find((file) => file.relativePath === selectedRelativePath) ??
      null
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

  const statusStats = getReviewStatusStats(reviewFiles.files)

  return (
    <div className="bg-muted/30 flex flex-1 flex-col p-4 md:p-6">
      <section className="bg-card text-card-foreground flex min-h-0 flex-1 flex-col rounded-xl border">
        <div className="border-b px-4 py-3 md:px-5 md:py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 pr-2">
              <GitBranchIcon className="text-muted-foreground size-4" />
              <span className="text-sm font-semibold tracking-wide">Code Review</span>
            </div>
            <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-2 py-1">
              <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
                Files
              </span>
              <span className="text-xs font-semibold">{reviewFiles.files.length}</span>
            </div>
            <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-2 py-1">
              <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
                Modified
              </span>
              <span className="text-xs font-semibold">{statusStats.modified}</span>
            </div>
            <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-2 py-1">
              <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
                Added
              </span>
              <span className="text-xs font-semibold">{statusStats.added}</span>
            </div>
            <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-2 py-1">
              <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
                Deleted
              </span>
              <span className="text-xs font-semibold">{statusStats.deleted}</span>
            </div>
            {reviewFiles.truncated ? (
              <span className="border-amber-500/30 bg-amber-500/10 text-amber-700 rounded-md border px-2 py-1 text-xs font-medium">
                truncated
              </span>
            ) : null}
            <div className="ml-auto inline-flex items-center rounded-md border p-1">
              <Link
                href={`/${workspaceId}/review?mode=changed`}
                className={cn(
                  "hover:bg-muted rounded-sm px-2 py-1 text-xs",
                  mode === "changed" && "bg-muted font-medium"
                )}
              >
                Changed
              </Link>
              <Link
                href={`/${workspaceId}/review?mode=all`}
                className={cn(
                  "hover:bg-muted rounded-sm px-2 py-1 text-xs",
                  mode === "all" && "bg-muted font-medium"
                )}
              >
                All Files
              </Link>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,360px)_minmax(0,1fr)] gap-4 p-4 md:p-5">
          <ReviewChangesPanel
            workspaceId={workspaceId}
            mode={mode}
            reviewFiles={reviewFiles}
            selectedRelativePath={selectedRelativePath}
          />
          <ReviewFilePanel
            filePreview={filePreview}
            selectedFile={selectedFile}
            previewError={previewError}
          />
        </div>
      </section>
    </div>
  )
}
