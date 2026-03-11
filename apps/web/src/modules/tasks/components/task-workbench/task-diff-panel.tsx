"use client"

import { useMemo, useState } from "react"

import { HighlightedCodeText, inferLanguageFromFilePath } from "@/components/code"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  type GitDiffFile,
  type GitDiffFileStatus,
  useProjectGitDiffQuery,
} from "@/modules/git"

import { getErrorMessage } from "./shared"

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
    badgeClassName: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  modified: {
    label: "Modified",
    badgeClassName: "bg-sky-100 text-sky-700 border-sky-200",
  },
  deleted: {
    label: "Deleted",
    badgeClassName: "bg-rose-100 text-rose-700 border-rose-200",
  },
  renamed: {
    label: "Renamed",
    badgeClassName: "bg-amber-100 text-amber-700 border-amber-200",
  },
  copied: {
    label: "Copied",
    badgeClassName: "bg-violet-100 text-violet-700 border-violet-200",
  },
  binary: {
    label: "Binary",
    badgeClassName: "bg-slate-100 text-slate-700 border-slate-200",
  },
  unknown: {
    label: "Changed",
    badgeClassName: "bg-slate-100 text-slate-700 border-slate-200",
  },
}

function formatLineNumber(value: number | null) {
  return value === null ? "" : String(value)
}

function DiffFileContent({ file }: { file: GitDiffFile }) {
  const language = useMemo(() => inferLanguageFromFilePath(file.path), [file.path])

  if (file.isBinary) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-4 text-xs">
        二进制文件暂不支持文本预览。
      </div>
    )
  }

  if (file.isTooLarge) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-4 text-xs">
        这个 diff 过大，当前版本先不完整展开。你仍然可以在文件列表里看到文件状态和变更统计。
      </div>
    )
  }

  if (file.hunks.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-4 text-xs">
        当前文件没有可展示的文本 diff。
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-md border">
      <div className="min-w-[680px] divide-y">
        {file.hunks.map((hunk) => (
          <div key={`${file.path}-${hunk.header}`} className="bg-background">
            <div className="bg-muted/60 border-b px-3 py-2 font-mono text-[11px] text-slate-700">
              {hunk.header}
            </div>

            <div>
              {hunk.lines.map((line, index) => (
                <div
                  key={`${file.path}-${hunk.header}-${index}`}
                  className={cn(
                    "grid grid-cols-[64px_64px_20px_minmax(0,1fr)] font-mono text-[11px] leading-5",
                    line.type === "add" && "bg-emerald-50/70",
                    line.type === "delete" && "bg-rose-50/70",
                    line.type === "meta" && "bg-slate-100/80 text-slate-600",
                  )}
                >
                  <span className="text-muted-foreground border-r px-2 py-0.5 text-right">
                    {formatLineNumber(line.oldLineNumber)}
                  </span>
                  <span className="text-muted-foreground border-r px-2 py-0.5 text-right">
                    {formatLineNumber(line.newLineNumber)}
                  </span>
                  <span
                    className={cn(
                      "border-r px-1 py-0.5 text-center",
                      line.type === "add" && "text-emerald-700",
                      line.type === "delete" && "text-rose-700",
                      line.type === "meta" && "text-slate-500",
                    )}
                  >
                    {line.type === "add"
                      ? "+"
                      : line.type === "delete"
                        ? "-"
                        : line.type === "meta"
                          ? "\\"
                          : " "}
                  </span>
                  <pre className="overflow-x-auto px-3 py-0.5 whitespace-pre-wrap break-words">
                    {line.content ? (
                      <HighlightedCodeText
                        code={line.content}
                        language={language}
                      />
                    ) : (
                      " "
                    )}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TaskDiffPanel({ projectId }: TaskDiffPanelProps) {
  const diffQuery = useProjectGitDiffQuery(projectId)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
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
            <p className="text-muted-foreground text-xs">基于当前项目工作区的 git diff 预览</p>
          </div>

          {files.length > 0 ? (
            <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
              <span>{files.length} files</span>
              <span className="text-emerald-700">+{totalAdditions}</span>
              <span className="text-rose-700">-{totalDeletions}</span>
            </div>
          ) : null}
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
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
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
                          <span className="mr-2 text-emerald-700">+{file.additions}</span>
                          <span className="text-rose-700">-{file.deletions}</span>
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
                    <DiffFileContent file={selectedFile} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-md border border-dashed text-xs">
              当前项目工作区没有可展示的 git diff。
            </div>
          )
        ) : null}
      </div>
    </section>
  )
}
