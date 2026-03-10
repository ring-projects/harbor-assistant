"use client"

import { SendHorizonalIcon } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  useTaskDetailQuery,
  useTaskFollowupMutation,
  useTaskTimelineQuery,
} from "@/modules/tasks/hooks/use-task-queries"

import {
  formatDateTime,
  getErrorMessage,
  getTimelineContent,
  getTimelineItemClassName,
  getTimelineLabel,
  truncateTaskId,
} from "./shared"

type TaskTimelinePanelProps = {
  projectId: string
  taskId: string | null
  onSelectTask: (taskId: string) => void
}

export function TaskTimelinePanel({
  projectId,
  taskId,
  onSelectTask,
}: TaskTimelinePanelProps) {
  const detailQuery = useTaskDetailQuery(taskId)
  const timelineQuery = useTaskTimelineQuery({
    taskId,
    enabled: Boolean(taskId),
  })
  const followupMutation = useTaskFollowupMutation(projectId)
  const [prompt, setPrompt] = useState("")

  const canSubmit = Boolean(taskId) && prompt.trim().length > 0
  const items = timelineQuery.data?.items ?? []

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!taskId || !prompt.trim()) {
      return
    }

    const nextPrompt = prompt.trim()
    try {
      await followupMutation.mutateAsync({
        taskId,
        prompt: nextPrompt,
      })

      setPrompt("")
      onSelectTask(taskId)
    } catch {
    }
  }

  return (
    <section className="bg-background h-full min-h-0 overflow-hidden p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Timeline</p>
            <p className="text-muted-foreground text-xs">
              任务消息、状态和输出统一展示
            </p>
          </div>

          {detailQuery.data?.threadId ? (
            <span className="text-muted-foreground rounded border px-2 py-0.5 font-mono text-[11px]">
              {truncateTaskId(detailQuery.data.threadId)}
            </span>
          ) : null}
        </div>

        {!taskId ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-md border border-dashed text-xs">
            请选择左侧任务
          </div>
        ) : null}

        {taskId && (detailQuery.isLoading || timelineQuery.isLoading) ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-md" />
            ))}
          </div>
        ) : null}

        {taskId && (detailQuery.isError || timelineQuery.isError) ? (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
            {getErrorMessage(detailQuery.error ?? timelineQuery.error)}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto rounded-md border p-3">
          {taskId &&
          !detailQuery.isLoading &&
          !timelineQuery.isLoading &&
          !detailQuery.isError &&
          !timelineQuery.isError &&
          items.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
              当前任务暂无时间线记录。
            </div>
          ) : null}

          {taskId &&
          !detailQuery.isLoading &&
          !timelineQuery.isLoading &&
          !detailQuery.isError &&
          !timelineQuery.isError &&
          items.length > 0 ? (
            <div className="space-y-2 pr-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn("rounded-md border p-2.5", getTimelineItemClassName(item))}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-full border bg-white/70 px-2 py-0.5 text-[11px]">
                        {getTimelineLabel(item)}
                      </span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        #{item.sequence}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-[11px]">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5">
                    {getTimelineContent(item)}
                  </pre>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <form className="grid gap-2 border-t pt-3" onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={taskId ? "继续这个线程…" : "请先选择任务"}
            disabled={!taskId || followupMutation.isPending}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-[92px] w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60"
          />

          {followupMutation.isError ? (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
              {getErrorMessage(followupMutation.error)}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-[11px]">
              Follow-up 会在同一线程继续对话，并把内容追加到当前 task。
            </p>
            <Button type="submit" size="sm" disabled={!canSubmit || followupMutation.isPending}>
              <SendHorizonalIcon className="size-4" />
              {followupMutation.isPending ? "发送中..." : "发送"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  )
}
