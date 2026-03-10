"use client"

import { useMemo } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useTaskDetailQuery } from "@/modules/tasks/hooks/use-task-queries"

import {
  extractChangedFiles,
  extractDiffBlocks,
  formatDateTime,
  getErrorMessage,
  STATUS_META,
} from "./shared"

type TaskDiffPanelProps = {
  taskId: string | null
}

export function TaskDiffPanel({ taskId }: TaskDiffPanelProps) {
  const detailQuery = useTaskDetailQuery(taskId)

  const detail = detailQuery.data
  const diffBlocks = useMemo(
    () =>
      detail
        ? [
            ...extractDiffBlocks(detail.stdout),
            ...extractDiffBlocks(detail.stderr),
          ]
        : [],
    [detail],
  )

  const changedFiles = useMemo(() => extractChangedFiles(diffBlocks), [diffBlocks])

  const outputPreview = useMemo(() => {
    if (!detail) {
      return ""
    }

    const combined = `${detail.stdout}\n${detail.stderr}`.trim()
    if (!combined) {
      return ""
    }

    if (combined.length <= 2_000) {
      return combined
    }

    return combined.slice(combined.length - 2_000)
  }, [detail])

  return (
    <section className="bg-background min-h-0 p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div>
          <p className="text-sm font-semibold">Diff</p>
        </div>

        {!taskId ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-md border border-dashed text-xs">
            请选择左侧任务
          </div>
        ) : null}

        {taskId && detailQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-md" />
            ))}
          </div>
        ) : null}

        {taskId && detailQuery.isError ? (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
            {getErrorMessage(detailQuery.error)}
          </div>
        ) : null}

        {taskId && !detailQuery.isLoading && !detailQuery.isError && detail ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">状态</p>
                <p className="pt-1">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5",
                      STATUS_META[detail.status].badgeClassName,
                    )}
                  >
                    {STATUS_META[detail.status].label}
                  </span>
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">退出码</p>
                <p className="pt-1 font-mono">
                  {detail.exitCode === null ? "-" : String(detail.exitCode)}
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">开始</p>
                <p className="pt-1">{formatDateTime(detail.startedAt)}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">结束</p>
                <p className="pt-1">{formatDateTime(detail.finishedAt)}</p>
              </div>
            </div>

            {changedFiles.length > 0 ? (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">变更文件</p>
                <div className="flex flex-wrap gap-1.5">
                  {changedFiles.map((filePath) => (
                    <span
                      key={filePath}
                      className="bg-muted rounded border px-2 py-0.5 font-mono text-[11px]"
                    >
                      {filePath}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {diffBlocks.length > 0 ? (
              <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                {diffBlocks.map((block, index) => (
                  <pre
                    key={`${index}-${block.slice(0, 20)}`}
                    className="bg-muted overflow-x-auto rounded-md border p-2 text-[11px] leading-5 whitespace-pre"
                  >
                    {block}
                  </pre>
                ))}
              </div>
            ) : outputPreview ? (
              <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                <pre className="bg-muted h-full overflow-x-auto p-2 text-[11px] leading-5 whitespace-pre-wrap">
                  {outputPreview}
                </pre>
              </div>
            ) : (
              <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-md border border-dashed text-xs">
                当前任务暂无 diff 或输出内容。
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  )
}
