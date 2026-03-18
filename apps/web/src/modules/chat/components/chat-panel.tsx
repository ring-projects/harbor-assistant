"use client"

import {
  ArrowDownIcon,
  BotIcon,
  GlobeIcon,
  SearchIcon,
  ShieldIcon,
  WifiIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  TERMINAL_TASK_STATUSES,
  type TaskDetail,
} from "@/modules/tasks/contracts"
import {
  formatExecutionModeLabel,
  formatExecutorLabel,
} from "@/modules/tasks/components/task-workbench/shared"
import {
  useTaskDetailQuery,
  useTaskEventStream,
  useTaskEventsQuery,
  useAgentCapabilitiesQuery,
  useBreakTaskTurnMutation,
  useTaskFollowupMutation,
} from "@/modules/tasks/hooks/use-task-queries"
import {
  selectChatUi,
  selectConversationBlocks,
  selectLastSequence,
  selectSelectedExecutionBlock,
  selectTaskDetail,
  useTasksSessionStore,
} from "@/modules/tasks/store"

import type { ChatConversationBlock } from "../types"
import { ChatComposer } from "./chat-composer"
import { ChatExecutionDrawer } from "./chat-execution-drawer"
import { ChatStream } from "./chat-stream"
import { CHAT_STATUS_META } from "./shared"

type ChatPanelProps = {
  projectId: string
  taskId: string | null
}

type FollowupModelMode = "task-default" | "runtime-default" | "custom"

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Failed to load. Please try again."
}

function canFollowup(detail: TaskDetail | null | undefined) {
  if (!detail || !detail.threadId) {
    return false
  }

  return TERMINAL_TASK_STATUSES.includes(detail.status)
}

function helperText(detail: TaskDetail | null | undefined, taskId: string | null) {
  if (!taskId) {
    return "Select a task from the left to begin."
  }

  if (!detail) {
    return "Loading task session details..."
  }

  if (!detail.threadId) {
    return "Wait for the thread to initialize before continuing the conversation."
  }

  if (!TERMINAL_TASK_STATUSES.includes(detail.status)) {
    return "This task is still running. Wait for the current reply to finish."
  }

  return ""
}

function getRunningLabel(detail: TaskDetail | null | undefined) {
  if (!detail) {
    return "Agent is working..."
  }

  return `${formatExecutorLabel(detail.executor)} is working...`
}

function formatModelSummary(model: string | null | undefined) {
  return model?.trim() || "Runtime Default"
}

function getRuntimePolicyItems(detail: TaskDetail | null | undefined) {
  const sandbox = detail?.runtimePolicy?.sandboxMode ?? "workspace-write"
  const networkEnabled = detail?.runtimePolicy?.networkAccessEnabled ?? false
  const searchMode = detail?.runtimePolicy?.webSearchMode ?? "disabled"

  return [
    {
      key: "mode",
      label: "mode",
      value: formatExecutionModeLabel(detail?.executionMode),
      icon: WifiIcon,
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    },
    {
      key: "sandbox",
      label: "sandbox",
      value: sandbox,
      icon: ShieldIcon,
      className: "border-sky-500/30 bg-sky-500/10 text-sky-700",
    },
    {
      key: "network",
      label: "network",
      value: networkEnabled ? "on" : "off",
      icon: GlobeIcon,
      className: networkEnabled
        ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-700"
        : "border-zinc-500/20 bg-zinc-500/10 text-zinc-500",
    },
    {
      key: "search",
      label: "search",
      value: searchMode,
      icon: SearchIcon,
      className:
        searchMode === "disabled"
          ? "border-zinc-500/20 bg-zinc-500/10 text-zinc-500"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700",
    },
  ] as const
}

function RuntimePolicySummary({ detail }: { detail: TaskDetail | null | undefined }) {
  const executorLabel = detail ? formatExecutorLabel(detail.executor) : "Assistant"
  const items = getRuntimePolicyItems(detail)

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
          <BotIcon className="size-3.5" />
          <span>{executorLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {items.map((item) => {
            const Icon = item.icon

            return (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full border transition-colors",
                      item.className,
                    )}
                    aria-label={`${item.label}: ${item.value}`}
                  >
                    <Icon className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {item.label}: {item.value}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
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
  const [followupModelMode, setFollowupModelMode] =
    useState<FollowupModelMode>("task-default")
  const [followupModel, setFollowupModel] = useState<string | null>(null)
  const detail = useTasksSessionStore((state) => selectTaskDetail(state, taskId))
  const blocksFromStore = useTasksSessionStore((state) =>
    selectConversationBlocks(state, taskId)
  )
  const chatUi = useTasksSessionStore((state) => selectChatUi(state, taskId))
  const lastSequence = useTasksSessionStore((state) => selectLastSequence(state, taskId))
  const selectedExecutionBlock = useTasksSessionStore((state) =>
    selectSelectedExecutionBlock(state, taskId)
  )
  const agentCapabilitiesQuery = useAgentCapabilitiesQuery({
    enabled: Boolean(taskId && detail?.executor),
  })
  const isBreaking = breakTurnMutation.isPending
  const isReady = canFollowup(detail)
  const isLoading = Boolean(taskId) && (detailQuery.isLoading || eventsQuery.isLoading)
  const isError = Boolean(taskId) && (detailQuery.isError || eventsQuery.isError)
  const selectedExecutorCapabilities =
    detail?.executor === "claude-code"
      ? agentCapabilitiesQuery.data?.agents["claude-code"] ?? null
      : detail?.executor
        ? agentCapabilitiesQuery.data?.agents.codex ?? null
        : null
  const selectedExecutorModels = selectedExecutorCapabilities?.models ?? []
  const selectedExecutorModelIds = useMemo(
    () => new Set(selectedExecutorModels.map((model) => model.id)),
    [selectedExecutorModels],
  )

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

  useEffect(() => {
    setFollowupModelMode("task-default")
    setFollowupModel(null)
  }, [taskId])

  useEffect(() => {
    if (followupModelMode !== "custom" || !followupModel) {
      return
    }

    if (selectedExecutorModels.length === 0 || selectedExecutorModelIds.has(followupModel)) {
      return
    }

    setFollowupModelMode("task-default")
    setFollowupModel(null)
  }, [
    followupModel,
    followupModelMode,
    selectedExecutorModelIds,
    selectedExecutorModels.length,
  ])

  function updateDraft(value: string) {
    if (!taskId) {
      return
    }

    useTasksSessionStore.getState().setDraft(taskId, value)
  }

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
  }

  function openExecutionDrawer(
    block: Extract<ChatConversationBlock, { type: "execution" }>,
  ) {
    if (!taskId) {
      return
    }

    useTasksSessionStore
      .getState()
      .setSelectedExecutionBlockId(taskId, block.id)
  }

  async function submitFollowup() {
    if (!taskId || !isReady || !chatUi.draft.trim() || isBreaking) {
      return
    }

    const nextPrompt = chatUi.draft.trim()
    useTasksSessionStore.getState().setPendingPrompt(taskId, {
      content: nextPrompt,
      baselineSequence: lastSequence,
    })

    try {
      await followupMutation.mutateAsync({
        taskId,
        prompt: nextPrompt,
        model: followupModelMode === "custom" ? followupModel ?? undefined : undefined,
        modelSource:
          followupModelMode === "custom" ? undefined : followupModelMode,
      })

      useTasksSessionStore.getState().setDraft(taskId, "")
    } catch {
      useTasksSessionStore.getState().setPendingPrompt(taskId, null)
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
            <RuntimePolicySummary detail={detail} />
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

          </div>
        </div>

        {!taskId ? (
          <div className="text-muted-foreground flex min-h-0 items-center justify-center rounded-xl border border-dashed text-sm">
            Select a task from the left to view the conversation.
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
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <ScrollArea
                viewportRef={scrollerRef}
                onViewportScroll={handleScroll}
                className="h-full min-h-0"
                viewportClassName="h-full min-h-0 px-4 py-4"
              >
                {blocks.length === 0 ? (
                  <div className="text-muted-foreground flex min-h-full items-center justify-center text-sm">
                    No messages are available for this conversation yet.
                  </div>
                ) : (
                  <ChatStream blocks={blocks} onOpenExecution={openExecutionDrawer} />
                )}
              </ScrollArea>

              {!chatUi.stickToBottom && blocks.length > 0 ? (
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
                      if (taskId) {
                        useTasksSessionStore.getState().setStickToBottom(taskId, true)
                      }
                    }}
                  >
                    <ArrowDownIcon className="size-4" />
                    Jump to latest
                  </Button>
                </div>
              ) : null}
            </div>

            <form className="min-h-0" onSubmit={handleSubmit}>
              <ChatComposer
                canSubmit={Boolean(taskId) && isReady && chatUi.draft.trim().length > 0 && !isBreaking}
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
                placeholder={taskId ? "Continue this conversation..." : "Select a task first"}
                value={chatUi.draft}
                toolbar={
                  taskId && detail ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-muted-foreground text-[11px]" htmlFor="followup-model">
                        Model
                      </label>
                      <select
                        id="followup-model"
                        value={
                          followupModelMode === "custom" && followupModel
                            ? `custom:${followupModel}`
                            : followupModelMode
                        }
                        disabled={followupMutation.isPending || isBreaking}
                        onChange={(event) => {
                          const nextValue = event.target.value

                          if (nextValue === "task-default" || nextValue === "runtime-default") {
                            setFollowupModelMode(nextValue)
                            setFollowupModel(null)
                            return
                          }

                          if (nextValue.startsWith("custom:")) {
                            setFollowupModelMode("custom")
                            setFollowupModel(nextValue.slice("custom:".length) || null)
                          }
                        }}
                        className="bg-background border-input min-w-56 rounded-md border px-3 py-1.5 text-sm"
                      >
                        <option value="task-default">
                          {`Current Task Setting (${formatModelSummary(detail.model)})`}
                        </option>
                        <option value="runtime-default">Runtime Default</option>
                        {selectedExecutorModels.map((model) => (
                          <option key={model.id} value={`custom:${model.id}`}>
                            {model.isDefault
                              ? `${model.displayName} (${model.id}, default)`
                              : `${model.displayName} (${model.id})`}
                          </option>
                        ))}
                      </select>

                      {agentCapabilitiesQuery.isLoading ? (
                        <span className="text-muted-foreground text-[11px]">
                          Loading model options...
                        </span>
                      ) : null}

                      {agentCapabilitiesQuery.isError ? (
                        <span className="text-muted-foreground text-[11px]">
                          Model list unavailable. You can still use the current task setting.
                        </span>
                      ) : null}
                    </div>
                  ) : null
                }
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
        open={selectedExecutionBlock !== null}
        onOpenChange={(open) => {
          if (!open && taskId) {
            useTasksSessionStore
              .getState()
              .setSelectedExecutionBlockId(taskId, null)
          }
        }}
      />
    </section>
  )
}
