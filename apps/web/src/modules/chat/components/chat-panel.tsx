"use client"

import { ArrowDownIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  TERMINAL_TASK_STATUSES,
  type TaskDetail,
} from "@/modules/tasks/contracts"
import { formatExecutorLabel } from "@/modules/tasks/components/task-workbench/shared"
import {
  useTaskDetailQuery,
  useTaskEventStream,
  useTaskEventsQuery,
  useBreakTaskTurnMutation,
  useTaskFollowupMutation,
} from "@/modules/tasks/hooks/use-task-queries"

import { toConversationBlocks } from "../mappers/to-conversation-blocks"
import type { ChatConversationBlock } from "../types"
import { ChatComposer } from "./chat-composer"
import { ChatExecutionDrawer } from "./chat-execution-drawer"
import { ChatStream } from "./chat-stream"
import { CHAT_STATUS_META, truncateThreadId } from "./shared"

type ChatPanelProps = {
  projectId: string
  taskId: string | null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "加载失败，请重试。"
}

function canFollowup(detail: TaskDetail | null | undefined) {
  if (!detail || !detail.threadId) {
    return false
  }

  return TERMINAL_TASK_STATUSES.includes(detail.status)
}

function helperText(detail: TaskDetail | null | undefined, taskId: string | null) {
  if (!taskId) {
    return "先从左侧选择一个 task。"
  }

  if (!detail) {
    return "加载当前会话信息..."
  }

  if (!detail.threadId) {
    return "等待 thread 初始化完成后，才能继续对话。"
  }

  if (!TERMINAL_TASK_STATUSES.includes(detail.status)) {
    return "当前 task 正在运行，等待回复完成后再继续。"
  }

  return ""
}

function getRunningLabel(detail: TaskDetail | null | undefined) {
  if (!detail) {
    return "Agent is working..."
  }

  return `${formatExecutorLabel(detail.executor)} is working...`
}

function formatRuntimePolicySummary(detail: TaskDetail | null | undefined) {
  if (!detail) {
    return "在同一个 task 中持续对话，并查看执行反馈。"
  }

  const mode = detail.executionMode ? detail.executionMode : "default"
  const sandbox = detail.runtimePolicy?.sandboxMode ?? "workspace-write"
  const network = detail.runtimePolicy?.networkAccessEnabled ? "network on" : "network off"
  const search = detail.runtimePolicy?.webSearchMode ?? "disabled"

  return `${formatExecutorLabel(detail.executor)} · ${mode} · ${sandbox} · ${network} · search ${search}`
}

export function ChatPanel({ projectId, taskId }: ChatPanelProps) {
  const detailQuery = useTaskDetailQuery(taskId)
  const eventsQuery = useTaskEventsQuery({
    taskId,
    enabled: Boolean(taskId),
  })
  useTaskEventStream({
    projectId,
    taskId,
    enabled: Boolean(taskId),
  })
  const breakTurnMutation = useBreakTaskTurnMutation(projectId)
  const followupMutation = useTaskFollowupMutation(projectId)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [stickToBottom, setStickToBottom] = useState(true)
  const [pendingPrompt, setPendingPrompt] = useState<{
    taskId: string
    content: string
    baselineSequence: number
  } | null>(null)
  const [selectedExecutionBlock, setSelectedExecutionBlock] = useState<
    Extract<ChatConversationBlock, { type: "execution" }> | null
  >(null)
  const [isExecutionDrawerOpen, setIsExecutionDrawerOpen] = useState(false)

  const detail = detailQuery.data
  const events = useMemo(() => eventsQuery.data?.items ?? [], [eventsQuery.data?.items])
  const draft = taskId ? (drafts[taskId] ?? "") : ""
  const isBreaking = breakTurnMutation.isPending
  const isReady = canFollowup(detail)
  const isLoading = Boolean(taskId) && (detailQuery.isLoading || eventsQuery.isLoading)
  const isError = Boolean(taskId) && (detailQuery.isError || eventsQuery.isError)
  const lastSequence = events.at(-1)?.sequence ?? 0
  const visiblePendingPrompt = useMemo(() => {
    if (!pendingPrompt || pendingPrompt.taskId !== taskId) {
      return null
    }

    const matchedUserMessage = events.some(
      (event) =>
        event.sequence > pendingPrompt.baselineSequence &&
        event.eventType === "message" &&
        event.payload.role === "user" &&
        typeof event.payload.content === "string" &&
        event.payload.content.trim() === pendingPrompt.content.trim(),
    )

    return matchedUserMessage ? null : pendingPrompt
  }, [events, pendingPrompt, taskId])

  const blocks = useMemo(() => {
    const mapped = toConversationBlocks(events)
    const nextBlocks: ChatConversationBlock[] = [...mapped]

    if (visiblePendingPrompt) {
      nextBlocks.push({
        id: `pending-${visiblePendingPrompt.baselineSequence}`,
        type: "message",
        role: "user",
        content: visiblePendingPrompt.content,
        timestamp: null,
        pending: true,
      })
    }

    if (detail?.status === "running") {
      nextBlocks.push({
        id: "assistant-typing",
        type: "typing",
        label: getRunningLabel(detail),
      })
    }

    return nextBlocks
  }, [detail?.status, events, visiblePendingPrompt])

  useEffect(() => {
    if (!stickToBottom) {
      return
    }

    const node = scrollerRef.current
    if (!node) {
      return
    }

    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth",
    })
  }, [blocks, stickToBottom])

  function updateDraft(value: string) {
    if (!taskId) {
      return
    }

    setDrafts((current) => ({
      ...current,
      [taskId]: value,
    }))
  }

  function handleScroll() {
    const node = scrollerRef.current
    if (!node) {
      return
    }

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
    setStickToBottom(distanceFromBottom < 48)
  }

  function openExecutionDrawer(
    block: Extract<ChatConversationBlock, { type: "execution" }>,
  ) {
    setSelectedExecutionBlock(block)
    setIsExecutionDrawerOpen(true)
  }

  async function submitFollowup() {
    if (!taskId || !isReady || !draft.trim() || isBreaking) {
      return
    }

    const nextPrompt = draft.trim()
    setPendingPrompt({
      taskId,
      content: nextPrompt,
      baselineSequence: lastSequence,
    })

    try {
      await followupMutation.mutateAsync({
        taskId,
        prompt: nextPrompt,
      })

      setDrafts((current) => ({
        ...current,
        [taskId]: "",
      }))
    } catch {
      setPendingPrompt(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submitFollowup()
  }

  async function handleBreakTurn() {
    if (!taskId || detail?.status !== "running" || isBreaking) {
      return
    }

    await breakTurnMutation.mutateAsync(taskId)
  }

  return (
    <section className="bg-background h-full min-h-0 min-w-0 overflow-hidden p-3">
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div>
            <p className="text-sm font-semibold">Conversation</p>
            <p className="text-muted-foreground text-xs">
              {formatRuntimePolicySummary(detail)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {detail?.status === "running" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleBreakTurn()
                }}
                disabled={isBreaking}
              >
                {isBreaking ? "Stopping..." : "Break"}
              </Button>
            ) : null}

            {detail?.status ? (
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-[11px]",
                  CHAT_STATUS_META[detail.status].badgeClassName,
                )}
              >
                {CHAT_STATUS_META[detail.status].label}
              </span>
            ) : null}

            {detail?.threadId ? (
              <span className="text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[11px]">
                {truncateThreadId(detail.threadId)}
              </span>
            ) : null}
          </div>
        </div>

        {!taskId ? (
          <div className="text-muted-foreground flex min-h-0 items-center justify-center rounded-xl border border-dashed text-sm">
            请选择左侧 task 开始查看对话。
          </div>
        ) : null}

        {isLoading ? (
          <div className="min-h-0 space-y-3 overflow-auto">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : null}

        {isError ? (
          <div className="min-h-0 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
            {getErrorMessage(detailQuery.error ?? eventsQuery.error)}
          </div>
        ) : null}

        {taskId && !isLoading && !isError ? (
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border bg-muted/20">
              <div
                ref={scrollerRef}
                onScroll={handleScroll}
                className="h-full min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4"
              >
                {blocks.length === 0 ? (
                  <div className="text-muted-foreground flex min-h-full items-center justify-center text-sm">
                    当前会话还没有可显示的消息。
                  </div>
                ) : (
                  <ChatStream blocks={blocks} onOpenExecution={openExecutionDrawer} />
                )}
              </div>

              {!stickToBottom && blocks.length > 0 ? (
                <div className="absolute right-4 bottom-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const node = scrollerRef.current
                      if (!node) {
                        return
                      }
                      node.scrollTo({
                        top: node.scrollHeight,
                        behavior: "smooth",
                      })
                      setStickToBottom(true)
                    }}
                  >
                    <ArrowDownIcon className="size-4" />
                    回到底部
                  </Button>
                </div>
              ) : null}
            </div>

            <form className="min-h-0" onSubmit={handleSubmit}>
              <ChatComposer
                canSubmit={Boolean(taskId) && isReady && draft.trim().length > 0 && !isBreaking}
                inputDisabled={
                  !taskId ||
                  !detail?.threadId ||
                  followupMutation.isPending ||
                  isBreaking
                }
                isSubmitting={followupMutation.isPending}
                helperText={
                  isBreaking ? "Stopping current turn..." : helperText(detail, taskId)
                }
                placeholder={taskId ? "继续这段对话…" : "请先选择 task"}
                value={draft}
                errorMessage={
                  breakTurnMutation.isError
                    ? getErrorMessage(breakTurnMutation.error)
                    : followupMutation.isError
                      ? getErrorMessage(followupMutation.error)
                      : null
                }
                onChange={updateDraft}
                onSubmit={() => {
                  void submitFollowup()
                }}
              />
            </form>
          </div>
        ) : null}
      </div>

      <ChatExecutionDrawer
        block={selectedExecutionBlock}
        open={isExecutionDrawerOpen}
        onOpenChange={(open) => {
          setIsExecutionDrawerOpen(open)
          if (!open) {
            setSelectedExecutionBlock(null)
          }
        }}
      />
    </section>
  )
}
