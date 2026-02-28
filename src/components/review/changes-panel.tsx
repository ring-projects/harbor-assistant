import Link from "next/link"
import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderSearch2Icon,
  PanelLeftIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type {
  ListReviewFilesResult,
  ReviewFile,
  ReviewListMode,
} from "@/services/review/types"

import type { ReviewDirectoryNode } from "./utils"
import {
  buildReviewDirectoryTree,
  getFileNameParts,
  getReviewStatusBadgeClass,
  getReviewStatusDotClass,
  getReviewStatusLabel,
} from "./utils"

type ReviewChangesPanelProps = {
  projectId: string
  mode: ReviewListMode
  reviewFiles: ListReviewFilesResult
  selectedRelativePath: string | null
}

const TREE_NODE_BASE_PADDING = 8
const TREE_NODE_INDENT_STEP = 14

function getTreeNodePadding(level: number) {
  return TREE_NODE_BASE_PADDING + level * TREE_NODE_INDENT_STEP
}

function ReviewFileItem(props: {
  file: ReviewFile
  level: number
  projectId: string
  mode: ReviewListMode
  selectedRelativePath: string | null
}) {
  const { file, level, projectId, mode, selectedRelativePath } = props
  const isSelected = file.relativePath === selectedRelativePath
  const fileName = getFileNameParts(file.relativePath)

  return (
    <li>
      <Link
        href={`/${projectId}/review?mode=${mode}&file=${encodeURIComponent(file.relativePath)}`}
        className={cn(
          "hover:bg-muted/70 flex min-h-8 items-start gap-2 rounded-md border border-transparent py-1.5 pr-2 transition-colors",
          isSelected &&
            "border-primary/30 bg-primary/5 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]",
        )}
        style={{ paddingLeft: getTreeNodePadding(level) }}
      >
        <span
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            getReviewStatusDotClass(file.status),
          )}
        />
        <FileTextIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{fileName.name}</p>
          <p className="text-muted-foreground truncate font-mono text-[11px]">
            {file.relativePath}
          </p>
        </div>
        {file.status ? (
          <span
            className={cn(
              "mt-0.5 ml-auto rounded border px-1.5 py-0.5 text-[10px] font-medium",
              getReviewStatusBadgeClass(file.status),
            )}
          >
            {getReviewStatusLabel(file.status)}
          </span>
        ) : null}
      </Link>
    </li>
  )
}

function ReviewDirectoryItem(props: {
  node: ReviewDirectoryNode
  level: number
  projectId: string
  mode: ReviewListMode
  selectedRelativePath: string | null
}) {
  const { node, level, projectId, mode, selectedRelativePath } = props

  return (
    <li>
      <details open={node.defaultOpen} className="group">
        <summary
          className="hover:bg-muted/60 flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-md py-1.5 pr-2 [&::-webkit-details-marker]:hidden"
          style={{ paddingLeft: getTreeNodePadding(level) }}
        >
          <ChevronRightIcon className="text-muted-foreground size-3.5 shrink-0 transition-transform group-open:rotate-90" />
          <FolderIcon className="text-muted-foreground size-4 shrink-0 group-open:hidden" />
          <FolderOpenIcon className="text-muted-foreground hidden size-4 shrink-0 group-open:block" />
          <span className="truncate text-sm font-medium">{node.name}</span>
          <span className="bg-background text-muted-foreground ml-auto rounded border px-1.5 py-0.5 text-[10px]">
            {node.fileCount}
          </span>
        </summary>
        <ul className="space-y-1">
          {node.directories.map((directoryNode) => (
            <ReviewDirectoryItem
              key={directoryNode.path}
              node={directoryNode}
              level={level + 1}
              projectId={projectId}
              mode={mode}
              selectedRelativePath={selectedRelativePath}
            />
          ))}
          {node.files.map((file) => (
            <ReviewFileItem
              key={file.absolutePath}
              file={file}
              level={level + 1}
              projectId={projectId}
              mode={mode}
              selectedRelativePath={selectedRelativePath}
            />
          ))}
        </ul>
      </details>
    </li>
  )
}

export function ReviewChangesPanel(props: ReviewChangesPanelProps) {
  const { projectId, mode, reviewFiles, selectedRelativePath } = props
  const directoryTree = buildReviewDirectoryTree({
    files: reviewFiles.files,
    selectedRelativePath,
  })

  return (
    <aside className="border-border flex min-h-0 flex-col rounded-lg border">
      <div className="border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <PanelLeftIcon className="text-muted-foreground size-4" />
          <p className="text-[11px] font-semibold tracking-wide">CHANGES</p>
          <span className="bg-muted text-muted-foreground ml-auto rounded border px-1.5 py-0.5 text-[10px]">
            {reviewFiles.files.length}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {mode === "changed"
            ? "Git working tree changes"
            : "Project file index"}
        </p>
      </div>

      {mode === "changed" && !reviewFiles.isGitRepository ? (
        <div className="border-b px-3 py-2">
          <p className="text-muted-foreground flex items-start gap-2 text-xs">
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
            Not a git repository. Switch to All Files mode.
          </p>
        </div>
      ) : null}

      {reviewFiles.files.length > 0 ? (
        <ScrollArea className="min-h-0 flex-1" viewportClassName="p-2">
          <ul className="space-y-1">
            {directoryTree.directories.map((directoryNode) => (
              <ReviewDirectoryItem
                key={directoryNode.path}
                node={directoryNode}
                level={0}
                projectId={projectId}
                mode={mode}
                selectedRelativePath={selectedRelativePath}
              />
            ))}
            {directoryTree.files.map((file) => (
              <ReviewFileItem
                key={file.absolutePath}
                file={file}
                level={0}
                projectId={projectId}
                mode={mode}
                selectedRelativePath={selectedRelativePath}
              />
            ))}
          </ul>
        </ScrollArea>
      ) : (
        <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center gap-2 px-3 py-6 text-sm">
          <FolderSearch2Icon className="size-4 shrink-0" />
          No files available for review.
        </div>
      )}
    </aside>
  )
}
