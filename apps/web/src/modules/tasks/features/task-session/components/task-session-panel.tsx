"use client"

import {
  ArrowDownIcon,
  ArrowUpIcon,
  WifiIcon,
} from "lucide-react"
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  selectChatUi,
  selectConversationBlocks,
  selectSelectedInspectorBlock,
  selectTaskDetail,
  useTasksSessionStore,
} from "@/modules/tasks/domain/store"
import { type TaskDetail } from "@/modules/tasks/contracts"
import {
  formatExecutionModeLabel,
  formatExecutorLabel,
  getTaskDisplayTitle,
} from "@/modules/tasks/domain/lib"
import {
  useTaskDetailQuery,
  useTaskEventStream,
  useTaskEventsQuery,
} from "@/modules/tasks/hooks/use-task-queries"

import type { ChatConversationBlock } from "../types"
import { ChatInteraction } from "../composer"
import { ChatStream } from "../conversation"
import { ChatDetailDrawer } from "./chat-detail-drawer"
import { CHAT_STATUS_META } from "./shared"

type TaskSessionPanelProps = {
  projectId: string
  taskId: string | null
}

const CHAT_WINDOW_INITIAL_SIZE = 160
const CHAT_WINDOW_EXPAND_STEP = 120
const CHAT_WINDOW_TOP_LOAD_THRESHOLD = 96

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Failed to load. Please try again."
}

function helperText(detail: TaskDetail | null | undefined, taskId: string | null) {
  if (!taskId) {
    return "Select a task from the left to begin."
  }

  if (!detail) {
    return "Loading task session details..."
  }

  if (detail.status === "running") {
    return "This task is still running. Follow-up input is intentionally disabled in the current backend contract."
  }

  return "Task follow-up is not available yet. This panel currently exposes the live execution stream and task metadata only."
}

function getRunningLabel(detail: TaskDetail | null | undefined) {
  if (!detail) {
    return "Agent is working..."
  }

  return `${formatExecutorLabel(detail.executor)} is working...`
}

export function TaskSessionPanel({ projectId, taskId }: TaskSessionPanelProps) {
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
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const detail = useTasksSessionStore((state) => selectTaskDetail(state, taskId))
  const blocksFromStore = useTasksSessionStore((state) =>
    selectConversationBlocks(state, taskId)
  )
  const chatUi = useTasksSessionStore((state) => selectChatUi(state, taskId))
  const selectedInspectorBlock = useTasksSessionStore((state) =>
    selectSelectedInspectorBlock(state, taskId)
  )
  const isLoading = Boolean(taskId) && (detailQuery.isLoading || eventsQuery.isLoading)
  const isError = Boolean(taskId) && (detailQuery.isError || eventsQuery.isError)
  const [windowState, setWindowState] = useState(() => ({
    taskId,
    visibleCount: CHAT_WINDOW_INITIAL_SIZE,
  }))

  const blocks = useMemo(() => {
    const nextBlocks: ChatConversationBlock[] = [...blocksFromStore]

    if (detail?.status === "running") {
      nextBlocks.push({
        id: "assistant-typing",
        type: "typing",
        label: getRunningLabel(detail),
      })
    }

    return nextBlocks
  }, [blocksFromStore, detail])
  const pendingWindowExpansionRef = useRef<{
    previousScrollHeight: number
    previousScrollTop: number
  } | null>(null)
  const visibleCount =
    chatUi.stickToBottom
      ? CHAT_WINDOW_INITIAL_SIZE
      : windowState.taskId === taskId
        ? Math.max(CHAT_WINDOW_INITIAL_SIZE, windowState.visibleCount)
        : CHAT_WINDOW_INITIAL_SIZE
  const conversationWindowStart = Math.max(0, blocks.length - visibleCount)
  const visibleBlocks = useMemo(
    () => blocks.slice(conversationWindowStart),
    [blocks, conversationWindowStart],
  )
  const hiddenBlockCount = Math.max(0, blocks.length - visibleBlocks.length)

  useLayoutEffect(() => {
    const pendingExpansion = pendingWindowExpansionRef.current
    if (!pendingExpansion) {
      return
    }

    const node = scrollerRef.current
    if (!node) {
      pendingWindowExpansionRef.current = null
      return
    }

    const scrollHeightDelta = node.scrollHeight - pendingExpansion.previousScrollHeight
    node.scrollTop = pendingExpansion.previousScrollTop + scrollHeightDelta
    pendingWindowExpansionRef.current = null
  }, [visibleBlocks])

  useEffect(() => {
    if (!chatUi.stickToBottom) {
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
  }, [blocks, chatUi.stickToBottom])

  function handleScroll() {
    if (!taskId) {
      return
    }

    const node = scrollerRef.current
    if (!node) {
      return
    }

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
    useTasksSessionStore.getState().setStickToBottom(taskId, distanceFromBottom < 48)

    if (
      node.scrollTop <= CHAT_WINDOW_TOP_LOAD_THRESHOLD &&
      conversationWindowStart > 0 &&
      !pendingWindowExpansionRef.current
    ) {
      pendingWindowExpansionRef.current = {
        previousScrollHeight: node.scrollHeight,
        previousScrollTop: node.scrollTop,
      }
      setWindowState((current) => ({
        taskId,
        visibleCount:
          (current.taskId === taskId
            ? current.visibleCount
            : CHAT_WINDOW_INITIAL_SIZE) + CHAT_WINDOW_EXPAND_STEP,
      }))
    }
  }

  function openInspectorDrawer(
    block: Extract<
      ChatConversationBlock,
      { type: "file-change" | "web-search" | "mcp-tool-call" | "command-group" }
    >,
  ) {
    if (!taskId) {
      return
    }

    useTasksSessionStore
      .getState()
      .setSelectedInspectorBlockId(taskId, block.id)
  }

  return (
    <section className="bg-background h-full min-h-0 min-w-0 overflow-hidden p-3">
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-2xl bg-muted/10 p-3">
        <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-mono text-[12px] font-semibold tracking-[0.08em] uppercase">Chat</p>
              {detail?.executor ? (
                <span className="text-muted-foreground inline-flex items-center rounded-md bg-background/45 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]">
                  {formatExecutorLabel(detail.executor)}
                </span>
              ) : null}
            </div>
            {detail ? (
              <p className="truncate font-mono text-[12px] leading-5 text-foreground/85">
                {getTaskDisplayTitle({
                  title: detail.title,
                  prompt: detail.prompt,
                })}
              </p>
            ) : (
              <p className="text-muted-foreground font-mono text-[11px]">
                Select a task to inspect messages and agent activity.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {detail?.status ? (
              <span
                className={cn(
                  "inline-flex rounded-md px-2 py-0.5 font-mono text-[11px] shadow-none",
                  CHAT_STATUS_META[detail.status].badgeClassName,
                )}
              >
                {CHAT_STATUS_META[detail.status].label}
              </span>
            ) : null}

            {detail?.model ? (
              <span className="text-muted-foreground hidden rounded-md bg-background/35 px-2 py-0.5 font-mono text-[11px] xl:inline-flex">
                {detail.model}
              </span>
            ) : null}

          </div>
        </div>

        {!taskId ? (
          <div className="text-muted-foreground flex min-h-0 items-center justify-center rounded-lg bg-background/25 font-mono text-[12px]">
            Select a task from the left to view the chat.
          </div>
        ) : null}

        {isLoading ? (
          <div className="min-h-0 space-y-3 overflow-auto">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : null}

        {isError ? (
          <div className="min-h-0 rounded-lg bg-rose-50 p-3 font-mono text-[12px] text-rose-700">
            {getErrorMessage(detailQuery.error ?? eventsQuery.error)}
          </div>
        ) : null}

        {taskId && !isLoading && !isError ? (
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3 overflow-hidden">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-background/28">
              <ScrollArea
                viewportRef={scrollerRef}
                onViewportScroll={handleScroll}
                className="h-full min-h-0"
                viewportClassName="h-full min-h-0 px-3 py-3"
              >
                {blocks.length === 0 ? (
                  <div className="text-muted-foreground flex min-h-full items-center justify-center font-mono text-[12px]">
                    No messages are available for this chat yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {hiddenBlockCount > 0 ? (
                      <div className="flex items-center justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-md border-dashed border-border/45 bg-background/45 px-2.5 font-mono text-[11px]"
                          onClick={() => {
                            const node = scrollerRef.current
                            if (!node) {
                              return
                            }

                            pendingWindowExpansionRef.current = {
                              previousScrollHeight: node.scrollHeight,
                              previousScrollTop: node.scrollTop,
                            }
                            setWindowState((current) => ({
                              taskId,
                              visibleCount:
                                (current.taskId === taskId
                                  ? current.visibleCount
                                  : CHAT_WINDOW_INITIAL_SIZE) + CHAT_WINDOW_EXPAND_STEP,
                            }))
                          }}
                        >
                          <ArrowUpIcon className="size-3.5" />
                          {`Load ${Math.min(CHAT_WINDOW_EXPAND_STEP, hiddenBlockCount)} earlier messages`}
                        </Button>
                      </div>
                    ) : null}

                    <ChatStream
                      blocks={visibleBlocks}
                      onOpenInspector={openInspectorDrawer}
                    />
                  </div>
                )}
              </ScrollArea>

              {!chatUi.stickToBottom && blocks.length > 0 ? (
                <div className="absolute right-4 bottom-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-md border-border/45 bg-background/75 font-mono text-[11px]"
                    onClick={() => {
                      const node = scrollerRef.current
                      if (!node) {
                        return
                      }
                      node.scrollTo({
                        top: node.scrollHeight,
                        behavior: "smooth",
                      })
                      if (taskId) {
                        useTasksSessionStore.getState().setStickToBottom(taskId, true)
                      }
                    }}
                  >
                    <ArrowDownIcon className="size-4" />
                    {hiddenBlockCount > 0 ? `Jump to latest (${hiddenBlockCount} hidden)` : "Jump to latest"}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="min-h-0">
              <ChatInteraction
                canSubmit={false}
                actionDisabled
                inputDisabled
                isSubmitting={false}
                helperText={helperText(detail, taskId)}
                placeholder={
                  taskId
                    ? "Follow-up input is intentionally unavailable in the current contract."
                    : "Select a task first"
                }
                value=""
                controls={
                  taskId && detail ? (
                    <>
                      {detail.executor ? (
                        <span className="inline-flex h-8 items-center gap-2 rounded-md bg-background/35 px-3 font-mono text-[11px] font-medium text-foreground/80">
                          <span>{formatExecutorLabel(detail.executor)}</span>
                        </span>
                      ) : null}
                      <span className="inline-flex h-8 items-center gap-2 rounded-md bg-background/35 px-3 font-mono text-[11px] font-medium text-foreground/80">
                        <WifiIcon className="size-3.5 text-muted-foreground" />
                        <span>{formatExecutionModeLabel(detail.executionMode ?? "connected")}</span>
                      </span>
                      {detail.model ? (
                        <span className="inline-flex h-8 items-center gap-2 rounded-md bg-background/35 px-3 font-mono text-[11px] font-medium text-foreground/80">
                          <span>{detail.model}</span>
                        </span>
                      ) : null}
                    </>
                  ) : null
                }
                footer={null}
                errorMessage={null}
                onChange={() => {}}
                onSubmit={() => {}}
              />
            </div>
          </div>
        ) : null}
      </div>

      <ChatDetailDrawer
        block={selectedInspectorBlock}
        open={selectedInspectorBlock !== null}
        onOpenChange={(open) => {
          if (!open && taskId) {
            useTasksSessionStore
              .getState()
              .setSelectedInspectorBlockId(taskId, null)
          }
        }}
      />
    </section>
  )
}
