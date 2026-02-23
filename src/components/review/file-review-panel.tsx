import { FileCode2Icon, FilesIcon } from "lucide-react"

import {
  InteractiveCodeBlock,
  inferLanguageFromFilePath,
} from "@/components/code"
import { MarkdownPreview } from "@/components/documents/preview"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { ReadReviewFileResult, ReviewFile } from "@/services/review/types"

import { getReviewStatusBadgeClass, getReviewStatusLabel } from "./utils"

type ReviewFilePanelProps = {
  filePreview: ReadReviewFileResult | null
  selectedFile: ReviewFile | null
  previewError: string | null
}

export function ReviewFilePanel(props: ReviewFilePanelProps) {
  const { filePreview, selectedFile, previewError } = props

  return (
    <article className="border-border flex min-h-0 flex-col rounded-lg border">
      <div className="border-b px-3 py-2.5">
        {filePreview ? (
          <div className="flex flex-wrap items-center gap-2">
            <FileCode2Icon className="text-muted-foreground size-4" />
            <p className="min-w-[220px] flex-1 truncate font-mono text-xs">
              {filePreview.relativePath}
            </p>
            {selectedFile?.status ? (
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                  getReviewStatusBadgeClass(selectedFile.status),
                )}
              >
                {getReviewStatusLabel(selectedFile.status)}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Select a file from the left panel.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 p-3">
        <section className="border-border flex min-h-0 flex-col rounded-md border">
          <div className="border-b px-3 py-2">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide">
              <FilesIcon className="text-muted-foreground size-3.5" />
              FILE CONTENT
            </p>
          </div>
          <ScrollArea className="min-h-0 flex-1" viewportClassName="p-4">
            {previewError ? (
              <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                {previewError}
              </div>
            ) : !filePreview ? (
              <p className="text-muted-foreground text-sm">
                Select a file to start review.
              </p>
            ) : filePreview.isMarkdown && filePreview.content ? (
              <MarkdownPreview
                key={`review-markdown:${filePreview.relativePath}`}
                content={filePreview.content}
                sourceId={`review-markdown:${filePreview.relativePath}`}
              />
            ) : filePreview.isText && filePreview.content ? (
              <InteractiveCodeBlock
                key={`review-file:${filePreview.relativePath}`}
                code={filePreview.content}
                language={inferLanguageFromFilePath(filePreview.relativePath)}
                sourceId={`review-file:${filePreview.relativePath}`}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                Binary file preview is not supported.
              </p>
            )}
          </ScrollArea>
        </section>
      </div>
    </article>
  )
}
