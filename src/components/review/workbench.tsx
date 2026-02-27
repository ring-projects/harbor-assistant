"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  BellIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileCode2Icon,
  FileTextIcon,
  FilesIcon,
  FolderIcon,
  FolderOpenIcon,
  GitBranchIcon,
  SearchIcon,
  UserCircleIcon,
  XIcon,
} from "lucide-react"

import {
  InteractiveCodeBlock,
  inferLanguageFromFilePath,
} from "@/components/code"
import { MarkdownPreview } from "@/components/documents/preview"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type {
  ListReviewFilesResult,
  ReadReviewFileResult,
  ReviewFile,
  ReviewListMode,
} from "@/services/review/types"

import type { ReviewDirectoryNode } from "./utils"
import {
  buildReviewDirectoryTree,
  getReviewStatusBadgeClass,
  getReviewStatusDotClass,
  getReviewStatusLabel,
  getReviewStatusStats,
} from "./utils"

type ReviewWorkbenchProps = {
  workspaceId: string
  mode: ReviewListMode
  reviewFiles: ListReviewFilesResult
  selectedRelativePath: string | null
  selectedFile: ReviewFile | null
  filePreview: ReadReviewFileResult | null
  previewError: string | null
}

type ActivityId = "explorer" | "search" | "git" | "tasks"

type FileNode = {
  id: string
  kind: "file"
  level: number
  file: ReviewFile
}

type DirectoryNode = {
  id: string
  kind: "directory"
  level: number
  directory: ReviewDirectoryNode
}

type TreeNode = FileNode | DirectoryNode

const ACTIVITY_ITEMS: Array<{
  id: ActivityId
  icon: React.ComponentType<{ className?: string }>
  label: string
}> = [
  {
    id: "explorer",
    icon: FilesIcon,
    label: "Explorer",
  },
  {
    id: "search",
    icon: SearchIcon,
    label: "Search",
  },
  {
    id: "git",
    icon: GitBranchIcon,
    label: "Git",
  },
  {
    id: "tasks",
    icon: CheckSquareIcon,
    label: "Tasks",
  },
]

function collectDefaultOpenPaths(node: ReviewDirectoryNode): string[] {
  const paths: string[] = []

  if (node.defaultOpen) {
    paths.push(node.path)
  }

  for (const child of node.directories) {
    paths.push(...collectDefaultOpenPaths(child))
  }

  return paths
}

function flattenDirectoryTree(args: {
  node: ReviewDirectoryNode
  level: number
  openDirectoryPaths: Set<string>
}): TreeNode[] {
  const { node, level, openDirectoryPaths } = args
  const rows: TreeNode[] = []

  for (const directory of node.directories) {
    rows.push({
      id: `dir:${directory.path}`,
      kind: "directory",
      level,
      directory,
    })

    if (openDirectoryPaths.has(directory.path)) {
      rows.push(
        ...flattenDirectoryTree({
          node: directory,
          level: level + 1,
          openDirectoryPaths,
        }),
      )
    }
  }

  for (const file of node.files) {
    rows.push({
      id: `file:${file.relativePath}`,
      kind: "file",
      level,
      file,
    })
  }

  return rows
}

function toFileHref(args: {
  workspaceId: string
  mode: ReviewListMode
  relativePath: string
}) {
  return `/${args.workspaceId}/review?mode=${args.mode}&file=${encodeURIComponent(args.relativePath)}`
}

function toModeHref(args: { workspaceId: string; mode: ReviewListMode }) {
  return `/${args.workspaceId}/review?mode=${args.mode}`
}

function getFileBreadcrumbParts(relativePath: string | null) {
  if (!relativePath) {
    return []
  }

  return relativePath.split("/").filter(Boolean)
}

export function ReviewWorkbench(props: ReviewWorkbenchProps) {
  const {
    workspaceId,
    mode,
    reviewFiles,
    selectedRelativePath,
    selectedFile,
    filePreview,
    previewError,
  } = props
  const router = useRouter()

  const [activeActivity, setActiveActivity] = useState<ActivityId>("explorer")
  const [closedTabPaths, setClosedTabPaths] = useState<Set<string>>(
    () => new Set(),
  )
  const [collapsedDirectoryPaths, setCollapsedDirectoryPaths] = useState<
    Set<string>
  >(() => new Set())

  const directoryTree = useMemo(
    () =>
      buildReviewDirectoryTree({
        files: reviewFiles.files,
        selectedRelativePath,
      }),
    [reviewFiles.files, selectedRelativePath],
  )

  const defaultOpenDirectoryPaths = useMemo(
    () => new Set(collectDefaultOpenPaths(directoryTree)),
    [directoryTree],
  )

  const openDirectoryPaths = useMemo(() => {
    const next = new Set(defaultOpenDirectoryPaths)
    for (const path of collapsedDirectoryPaths) {
      next.delete(path)
    }
    return next
  }, [collapsedDirectoryPaths, defaultOpenDirectoryPaths])

  const flattenedTree = useMemo(
    () =>
      flattenDirectoryTree({
        node: directoryTree,
        level: 0,
        openDirectoryPaths,
      }),
    [directoryTree, openDirectoryPaths],
  )

  const tabFiles = useMemo(() => {
    const baseTabPaths: string[] = []
    if (selectedRelativePath) {
      baseTabPaths.push(selectedRelativePath)
    }

    for (const file of reviewFiles.files) {
      if (baseTabPaths.length >= 4) {
        break
      }

      if (!baseTabPaths.includes(file.relativePath)) {
        baseTabPaths.push(file.relativePath)
      }
    }

    const pathToFile = new Map<string, ReviewFile>()
    for (const file of reviewFiles.files) {
      pathToFile.set(file.relativePath, file)
    }

    return baseTabPaths
      .filter((relativePath) => !closedTabPaths.has(relativePath))
      .map((relativePath) => pathToFile.get(relativePath))
      .filter((file): file is ReviewFile => Boolean(file))
  }, [closedTabPaths, reviewFiles.files, selectedRelativePath])

  const statusStats = useMemo(
    () => getReviewStatusStats(reviewFiles.files),
    [reviewFiles.files],
  )

  const breadcrumbParts = useMemo(
    () => getFileBreadcrumbParts(selectedRelativePath),
    [selectedRelativePath],
  )

  const onToggleDirectory = (directoryPath: string) => {
    setCollapsedDirectoryPaths((previous) => {
      const next = new Set(previous)
      const isCurrentlyOpen = openDirectoryPaths.has(directoryPath)
      if (isCurrentlyOpen) {
        next.add(directoryPath)
      } else {
        next.delete(directoryPath)
      }
      return next
    })
  }

  const onSelectFile = (relativePath: string) => {
    setClosedTabPaths((previous) => {
      if (!previous.has(relativePath)) {
        return previous
      }

      const next = new Set(previous)
      next.delete(relativePath)
      return next
    })

    const href = toFileHref({
      workspaceId,
      mode,
      relativePath,
    })
    router.push(href)
  }

  const onCloseTab = (relativePath: string) => {
    setClosedTabPaths((previous) => {
      const next = new Set(previous)
      next.add(relativePath)
      return next
    })

    if (relativePath !== selectedRelativePath) {
      return
    }

    const currentTabPaths = tabFiles.map((file) => file.relativePath)
    const currentIndex = currentTabPaths.indexOf(relativePath)
    const fallbackPath =
      currentTabPaths[currentIndex + 1] ??
      currentTabPaths[currentIndex - 1] ??
      reviewFiles.files[0]?.relativePath ??
      null

    if (!fallbackPath) {
      router.push(toModeHref({ workspaceId, mode }))
      return
    }

    onSelectFile(fallbackPath)
  }

  return (
    <section className="bg-card text-card-foreground flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="bg-muted/60 border-r px-1 py-2">
          <div className="flex h-full w-10 flex-col items-center gap-2">
            {ACTIVITY_ITEMS.map((item) => {
              const isActive = item.id === activeActivity
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => setActiveActivity(item.id)}
                  className={cn(
                    "hover:bg-muted relative flex h-10 w-full items-center justify-center rounded-md",
                    isActive && "text-primary bg-background",
                  )}
                >
                  {isActive ? (
                    <span className="bg-primary absolute top-1 bottom-1 left-0 w-0.5 rounded-full" />
                  ) : null}
                  <item.icon className="size-4" />
                </button>
              )
            })}
            <div className="mt-auto flex w-full flex-col items-center gap-2">
              <button
                type="button"
                className="hover:bg-muted flex h-8 w-full items-center justify-center rounded-md"
                title="Account"
              >
                <UserCircleIcon className="size-4" />
              </button>
            </div>
          </div>
        </aside>

        <aside className="bg-muted/40 flex min-h-0 w-72 shrink-0 flex-col border-r">
          <div className="border-b px-3 py-2">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              {activeActivity === "explorer" && "Explorer"}
              {activeActivity === "search" && "Search"}
              {activeActivity === "git" && "Git Changes"}
              {activeActivity === "tasks" && "Tasks"}
            </p>
          </div>

          {activeActivity === "explorer" ? (
            <ScrollArea className="min-h-0 flex-1" viewportClassName="p-2">
              <ul className="space-y-1">
                {flattenedTree.length === 0 ? (
                  <li className="text-muted-foreground rounded-md border border-dashed px-2 py-3 text-sm">
                    No files to display.
                  </li>
                ) : (
                  flattenedTree.map((node) => {
                    if (node.kind === "directory") {
                      const isOpen = openDirectoryPaths.has(node.directory.path)
                      return (
                        <li key={node.id}>
                          <button
                            type="button"
                            onClick={() =>
                              onToggleDirectory(node.directory.path)
                            }
                            className="hover:bg-muted flex w-full items-center gap-1.5 rounded-md py-1 text-left"
                            style={{ paddingLeft: `${node.level * 14 + 6}px` }}
                          >
                            {isOpen ? (
                              <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0" />
                            ) : (
                              <ChevronRightIcon className="text-muted-foreground size-3.5 shrink-0" />
                            )}
                            {isOpen ? (
                              <FolderOpenIcon className="text-muted-foreground size-3.5 shrink-0" />
                            ) : (
                              <FolderIcon className="text-muted-foreground size-3.5 shrink-0" />
                            )}
                            <span className="truncate text-xs font-medium">
                              {node.directory.name}
                            </span>
                            <span className="bg-background text-muted-foreground ml-auto rounded border px-1 py-0.5 text-[10px]">
                              {node.directory.fileCount}
                            </span>
                          </button>
                        </li>
                      )
                    }

                    const file = node.file
                    const isSelected =
                      file.relativePath === selectedRelativePath
                    return (
                      <li key={node.id}>
                        <button
                          type="button"
                          onClick={() => onSelectFile(file.relativePath)}
                          className={cn(
                            "hover:bg-muted flex w-full items-center gap-1.5 rounded-md py-1 text-left",
                            isSelected && "bg-primary/10",
                          )}
                          style={{ paddingLeft: `${node.level * 14 + 24}px` }}
                        >
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              getReviewStatusDotClass(file.status),
                            )}
                          />
                          <FileTextIcon className="text-muted-foreground size-3.5 shrink-0" />
                          <span className="truncate text-xs">
                            {file.relativePath}
                          </span>
                          {file.status ? (
                            <span
                              className={cn(
                                "ml-auto rounded border px-1 py-0.5 text-[10px] font-medium",
                                getReviewStatusBadgeClass(file.status),
                              )}
                            >
                              {getReviewStatusLabel(file.status)}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            </ScrollArea>
          ) : null}

          {activeActivity === "git" ? (
            <div className="space-y-3 p-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-background rounded-md border px-2 py-1.5">
                  <p className="text-muted-foreground">Files</p>
                  <p className="font-semibold">{reviewFiles.files.length}</p>
                </div>
                <div className="bg-background rounded-md border px-2 py-1.5">
                  <p className="text-muted-foreground">Modified</p>
                  <p className="font-semibold">{statusStats.modified}</p>
                </div>
                <div className="bg-background rounded-md border px-2 py-1.5">
                  <p className="text-muted-foreground">Added</p>
                  <p className="font-semibold">{statusStats.added}</p>
                </div>
                <div className="bg-background rounded-md border px-2 py-1.5">
                  <p className="text-muted-foreground">Deleted</p>
                  <p className="font-semibold">{statusStats.deleted}</p>
                </div>
              </div>
              <div className="inline-flex rounded-md border p-1">
                <Link
                  href={toModeHref({ workspaceId, mode: "changed" })}
                  className={cn(
                    "hover:bg-muted rounded-sm px-2 py-1 text-xs",
                    mode === "changed" && "bg-muted font-medium",
                  )}
                >
                  Changed
                </Link>
                <Link
                  href={toModeHref({ workspaceId, mode: "all" })}
                  className={cn(
                    "hover:bg-muted rounded-sm px-2 py-1 text-xs",
                    mode === "all" && "bg-muted font-medium",
                  )}
                >
                  All Files
                </Link>
              </div>
            </div>
          ) : null}

          {activeActivity === "search" ? (
            <div className="text-muted-foreground p-3 text-sm">
              Search panel will be connected in the next iteration.
            </div>
          ) : null}

          {activeActivity === "tasks" ? (
            <div className="space-y-3 p-3 text-sm">
              <p className="text-muted-foreground">
                Open workspace tasks to run Codex operations.
              </p>
              <Link
                href={`/${workspaceId}/tasks`}
                className="bg-background hover:bg-muted inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                Go To Tasks
              </Link>
            </div>
          ) : null}
        </aside>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="bg-muted/40 flex h-9 shrink-0 items-center overflow-x-auto border-b">
            {tabFiles.length === 0 ? (
              <div className="text-muted-foreground px-3 text-xs">
                No open files
              </div>
            ) : (
              tabFiles.map((file) => {
                const isActive = file.relativePath === selectedRelativePath
                return (
                  <button
                    key={file.relativePath}
                    type="button"
                    onClick={() => onSelectFile(file.relativePath)}
                    className={cn(
                      "hover:bg-muted group relative inline-flex h-full max-w-[260px] min-w-[120px] items-center gap-1.5 border-r px-3 text-xs",
                      isActive ? "bg-background" : "text-muted-foreground",
                    )}
                  >
                    {isActive ? (
                      <span className="bg-primary absolute top-0 right-0 left-0 h-0.5" />
                    ) : null}
                    <FileCode2Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{file.relativePath}</span>
                    <span
                      role="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onCloseTab(file.relativePath)
                      }}
                      className="hover:bg-muted ml-auto inline-flex size-4 items-center justify-center rounded-sm"
                    >
                      <XIcon className="size-3" />
                    </span>
                  </button>
                )
              })
            )}
          </div>

          <div className="bg-background/80 text-muted-foreground flex h-6 shrink-0 items-center gap-1 border-b px-3 text-xs">
            {breadcrumbParts.length === 0 ? (
              <span>No file selected</span>
            ) : (
              breadcrumbParts.map((part, index) => (
                <div
                  key={`${part}:${index}`}
                  className="inline-flex items-center gap-1"
                >
                  {index > 0 ? <ChevronRightIcon className="size-3" /> : null}
                  <span
                    className={cn(
                      index === breadcrumbParts.length - 1 &&
                        "text-foreground font-medium",
                    )}
                  >
                    {part}
                  </span>
                </div>
              ))
            )}
            {selectedFile?.status ? (
              <span
                className={cn(
                  "ml-auto rounded border px-1 py-0.5 text-[10px] font-medium",
                  getReviewStatusBadgeClass(selectedFile.status),
                )}
              >
                {getReviewStatusLabel(selectedFile.status)}
              </span>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full" viewportClassName="p-3 md:p-4">
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
                  key={`review-workbench-markdown:${filePreview.relativePath}`}
                  content={filePreview.content}
                  sourceId={`review-workbench-markdown:${filePreview.relativePath}`}
                />
              ) : filePreview.isText && filePreview.content ? (
                <InteractiveCodeBlock
                  key={`review-workbench-file:${filePreview.relativePath}`}
                  code={filePreview.content}
                  language={inferLanguageFromFilePath(filePreview.relativePath)}
                  sourceId={`review-workbench-file:${filePreview.relativePath}`}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Binary file preview is not supported.
                </p>
              )}
            </ScrollArea>
          </div>
        </main>
      </div>

      <footer className="bg-primary text-primary-foreground flex h-6 items-center justify-between px-2 text-[11px]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <GitBranchIcon className="size-3.5" />
            {mode === "changed" ? "changed" : "all"}
          </span>
          <span>{reviewFiles.isGitRepository ? "git ready" : "no git"}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{selectedRelativePath ? selectedRelativePath : "No file"}</span>
          <BellIcon className="size-3.5" />
        </div>
      </footer>
    </section>
  )
}
