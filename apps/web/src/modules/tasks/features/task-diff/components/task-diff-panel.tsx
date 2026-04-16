"use client"

import { useMemo, useState } from "react"
import { Diff, Hunk, parseDiff, type DiffType, type ViewType } from "react-diff-view"

import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  type GitDiffFile,
  type GitDiffFileStatus,
  useProjectGitDiffQuery,
  useProjectGitStream,
} from "@/modules/git"
import { getErrorMessage } from "@/modules/tasks/view-models"

type TaskDiffPanelProps = {
  projectId: string
}

const DIFF_STATUS_META: Record<
  GitDiffFileStatus,
  {
    label: string
    badgeClassName: string
  }
> = {
  added: {
    label: "Added",
    badgeClassName: "border-success/25 bg-surface-success text-success",
  },
  modified: {
    label: "Modified",
    badgeClassName: "border-info/25 bg-surface-info text-info",
  },
  deleted: {
    label: "Deleted",
    badgeClassName: "border-destructive/25 bg-surface-danger text-destructive",
  },
  renamed: {
    label: "Renamed",
    badgeClassName: "border-warning/25 bg-surface-warning text-warning",
  },
  copied: {
    label: "Copied",
    badgeClassName: "border-info/25 bg-surface-info text-info",
  },
  binary: {
    label: "Binary",
    badgeClassName: "border-border bg-secondary/40 text-muted-foreground",
  },
  unknown: {
    label: "Changed",
    badgeClassName: "border-border bg-secondary/40 text-muted-foreground",
  },
}

function DiffFileContent(args: { file: GitDiffFile; viewType: ViewType }) {
  const { file, viewType } = args
  const parsedFile = useMemo(() => {
    if (!file.patch.trim()) {
      return null
    }

    const [firstFile] = parseDiff(file.patch, {
      nearbySequences: "zip",
    })

    return firstFile ?? null
  }, [file.patch])

  if (file.isBinary) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-4 text-xs">
        Binary files do not support text preview yet.
      </div>
    )
  }

  if (file.isTooLarge) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-4 text-xs">
        This diff is too large to expand fully in the current version. You can still inspect file status and change counts in the file list.
      </div>
    )
  }

  if (!parsedFile || parsedFile.hunks.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-4 text-xs">
        No text diff is available for this file.
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-md border bg-background">
      <div className="min-w-[680px]">
        <Diff
          viewType={viewType}
          diffType={parsedFile.type as DiffType}
          hunks={parsedFile.hunks}
          gutterType="default"
          className="rdv-table w-full"
        >
          {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
        </Diff>
      </div>
    </div>
  )
}

export function TaskDiffPanel({ projectId }: TaskDiffPanelProps) {
  useProjectGitStream(projectId)
  const diffQuery = useProjectGitDiffQuery(projectId)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [viewType, setViewType] = useState<ViewType>("unified")
  const files = useMemo(() => diffQuery.data?.files ?? [], [diffQuery.data?.files])
  const resolvedSelectedFilePath = useMemo(() => {
    if (files.length === 0) {
      return null
    }

    if (selectedFilePath && files.some((file) => file.path === selectedFilePath)) {
      return selectedFilePath
    }

    return files[0].path
  }, [files, selectedFilePath])

  const selectedFile = useMemo(() => {
    if (files.length === 0 || !resolvedSelectedFilePath) {
      return null
    }

    return files.find((file) => file.path === resolvedSelectedFilePath) ?? files[0]
  }, [files, resolvedSelectedFilePath])

  const totalAdditions = useMemo(
    () => files.reduce((sum, file) => sum + file.additions, 0),
    [files],
  )
  const totalDeletions = useMemo(
    () => files.reduce((sum, file) => sum + file.deletions, 0),
    [files],
  )

  return (
    <section className="bg-background min-h-0 overflow-hidden p-3">
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Diff</p>
            <p className="text-muted-foreground text-xs">
              Git diff preview for the current project workspace
            </p>
          </div>

          <div className="flex items-center gap-3">
            {files.length > 0 ? (
              <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
                <span>{files.length} files</span>
                <span className="text-success">+{totalAdditions}</span>
                <span className="text-destructive">-{totalDeletions}</span>
              </div>
            ) : null}

            <Tabs
              value={viewType}
              onValueChange={(value) => {
                if (value === "split" || value === "unified") {
                  setViewType(value)
                }
              }}
            >
              <TabsList className="h-8">
                <TabsTrigger value="unified" className="px-3 text-[11px]">
                  Unified
                </TabsTrigger>
                <TabsTrigger value="split" className="px-3 text-[11px]">
                  Split
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {diffQuery.isLoading ? (
          <div className="grid min-h-0 flex-1 gap-3 overflow-hidden xl:grid-cols-[240px_minmax(0,1fr)]">
            <div className="min-h-0 space-y-2 overflow-hidden">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-md" />
              ))}
            </div>
            <div className="min-h-0 space-y-2 overflow-hidden">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-10 rounded-md" />
              ))}
            </div>
          </div>
        ) : null}

        {diffQuery.isError ? (
          <div className="bg-surface-danger text-destructive rounded-md border border-destructive/25 p-3 text-xs">
            {getErrorMessage(diffQuery.error)}
          </div>
        ) : null}

        {!diffQuery.isLoading && !diffQuery.isError ? (
          files.length > 0 && selectedFile ? (
            <div className="grid min-h-0 flex-1 gap-3 overflow-hidden xl:grid-cols-[240px_minmax(0,1fr)]">
              <div className="min-h-0 overflow-auto rounded-md border">
                <div className="divide-y">
                  {files.map((file) => {
                    const meta = DIFF_STATUS_META[file.status]
                    const isSelected = file.path === selectedFile.path

                    return (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => setSelectedFilePath(file.path)}
                        className={cn(
                          "w-full p-3 text-left transition-colors",
                          isSelected ? "bg-primary/6" : "hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 font-mono text-[11px]">{file.path}</p>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[10px]",
                              meta.badgeClassName,
                            )}
                          >
                            {meta.label}
                          </span>
                        </div>

                        {file.oldPath && file.oldPath !== file.path ? (
                          <p className="text-muted-foreground pt-1 font-mono text-[10px]">
                            from {file.oldPath}
                          </p>
                        ) : null}

                        <div className="pt-2 text-[11px]">
                          <span className="text-success mr-2">+{file.additions}</span>
                          <span className="text-destructive">-{file.deletions}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="min-h-0 overflow-auto">
                <div className="flex min-h-0 flex-col gap-3">
                  <div className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs">{selectedFile.path}</p>
                        {selectedFile.oldPath && selectedFile.oldPath !== selectedFile.path ? (
                          <p className="text-muted-foreground truncate pt-1 font-mono text-[11px]">
                            from {selectedFile.oldPath}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[11px]",
                          DIFF_STATUS_META[selectedFile.status].badgeClassName,
                        )}
                      >
                        {DIFF_STATUS_META[selectedFile.status].label}
                      </span>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1">
                    <DiffFileContent file={selectedFile} viewType={viewType} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-md border border-dashed text-xs">
              No git diff is available for the current project workspace.
            </div>
          )
        ) : null}
      </div>
    </section>
  )
}
