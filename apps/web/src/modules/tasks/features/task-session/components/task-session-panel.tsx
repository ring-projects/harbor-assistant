"use client"

import {
  ArrowDownIcon,
  ArrowUpIcon,
  BotIcon,
  ChevronDownIcon,
  ImageIcon,
  PlusIcon,
  WifiIcon,
  XIcon,
} from "lucide-react"
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  selectChatUi,
  selectConversationBlocks,
  selectLastSequence,
  selectSelectedInspectorBlock,
  selectTaskDetail,
  useTasksSessionStore,
} from "@/modules/tasks/domain/store"
import { storeTaskInputImage } from "@/modules/tasks/api"
import {
  TERMINAL_TASK_STATUSES,
  type TaskDetail,
} from "@/modules/tasks/contracts"
import {
  formatExecutionModeLabel,
  formatExecutorLabel,
  getTaskDisplayTitle,
} from "@/modules/tasks/domain/lib"
import {
  useTaskDetailQuery,
  useTaskEventStream,
  useTaskEventsQuery,
  useAgentCapabilitiesQuery,
  useBreakTaskTurnMutation,
  useTaskFollowupMutation,
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

type FollowupModelMode = "task-default" | "runtime-default" | "custom"
type FollowupSelection = {
  taskId: string | null
  mode: FollowupModelMode
  model: string | null
}

type PendingImageAttachment = {
  id: string
  file: File
  previewUrl: string
}

const ACCEPTED_IMAGE_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
])

const CHAT_WINDOW_INITIAL_SIZE = 160
const CHAT_WINDOW_EXPAND_STEP = 120
const CHAT_WINDOW_TOP_LOAD_THRESHOLD = 96

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
    return "Wait for the thread to initialize before continuing the chat."
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

function describePendingPrompt(text: string, imageCount: number) {
  if (text) {
    return text
  }

  if (imageCount === 1) {
    return "Shared 1 image"
  }

  if (imageCount > 1) {
    return `Shared ${imageCount} images`
  }

  return ""
}

async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`))
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.readAsDataURL(file)
  })

  const [, encoded = ""] = dataUrl.split(",", 2)
  return encoded
}

function formatModelSummary(model: string | null | undefined) {
  return model?.trim() || "Runtime Default"
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
  const breakTurnMutation = useBreakTaskTurnMutation(projectId)
  const followupMutation = useTaskFollowupMutation(projectId)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingImagesRef = useRef<PendingImageAttachment[]>([])
  const detail = useTasksSessionStore((state) => selectTaskDetail(state, taskId))
  const blocksFromStore = useTasksSessionStore((state) =>
    selectConversationBlocks(state, taskId)
  )
  const chatUi = useTasksSessionStore((state) => selectChatUi(state, taskId))
  const lastSequence = useTasksSessionStore((state) => selectLastSequence(state, taskId))
  const selectedInspectorBlock = useTasksSessionStore((state) =>
    selectSelectedInspectorBlock(state, taskId)
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
  const selectedExecutorModels = useMemo(
    () => selectedExecutorCapabilities?.models ?? [],
    [selectedExecutorCapabilities],
  )
  const selectedExecutorModelIds = useMemo(
    () => new Set(selectedExecutorModels.map((model) => model.id)),
    [selectedExecutorModels],
  )
  const [followupSelection, setFollowupSelection] = useState<FollowupSelection>({
    taskId,
    mode: "task-default",
    model: null,
  })
  const [pendingImages, setPendingImages] = useState<PendingImageAttachment[]>([])
  const [conversationWindowStart, setConversationWindowStart] = useState(0)
  const activeFollowupSelection =
    followupSelection.taskId === taskId
      ? followupSelection
      : {
          taskId,
          mode: "task-default" as const,
          model: null,
        }
  const sanitizedFollowupSelection =
    activeFollowupSelection.mode === "custom" &&
    activeFollowupSelection.model &&
    selectedExecutorModels.length > 0 &&
    !selectedExecutorModelIds.has(activeFollowupSelection.model)
      ? {
          taskId,
          mode: "task-default" as const,
          model: null,
        }
      : activeFollowupSelection

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
  const previousTaskIdRef = useRef<string | null>(null)
  const visibleBlocks = useMemo(
    () => blocks.slice(conversationWindowStart),
    [blocks, conversationWindowStart],
  )
  const hiddenBlockCount = Math.max(0, blocks.length - visibleBlocks.length)

  useEffect(() => {
    const nextTaskId = taskId ?? null

    if (previousTaskIdRef.current === nextTaskId) {
      return
    }

    previousTaskIdRef.current = nextTaskId
    pendingWindowExpansionRef.current = null
    setConversationWindowStart(
      Math.max(0, blocks.length - CHAT_WINDOW_INITIAL_SIZE),
    )
  }, [blocks.length, taskId])

  useEffect(() => {
    const maxStart = Math.max(0, blocks.length - 1)
    if (conversationWindowStart <= maxStart) {
      return
    }

    setConversationWindowStart(maxStart)
  }, [blocks.length, conversationWindowStart])

  useEffect(() => {
    if (!chatUi.stickToBottom) {
      return
    }

    const tailWindowStart = Math.max(0, blocks.length - CHAT_WINDOW_INITIAL_SIZE)
    if (conversationWindowStart === tailWindowStart) {
      return
    }

    pendingWindowExpansionRef.current = null
    setConversationWindowStart(tailWindowStart)
  }, [blocks.length, chatUi.stickToBottom, conversationWindowStart])

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

  useEffect(() => {
    pendingImagesRef.current = pendingImages
  }, [pendingImages])

  useEffect(() => {
    setPendingImages((current) => {
      for (const item of current) {
        URL.revokeObjectURL(item.previewUrl)
      }

      return []
    })
  }, [taskId])

  useEffect(() => {
    return () => {
      for (const item of pendingImagesRef.current) {
        URL.revokeObjectURL(item.previewUrl)
      }
    }
  }, [])

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

    if (
      node.scrollTop <= CHAT_WINDOW_TOP_LOAD_THRESHOLD &&
      conversationWindowStart > 0 &&
      !pendingWindowExpansionRef.current
    ) {
      pendingWindowExpansionRef.current = {
        previousScrollHeight: node.scrollHeight,
        previousScrollTop: node.scrollTop,
      }
      setConversationWindowStart((current) =>
        Math.max(0, current - CHAT_WINDOW_EXPAND_STEP),
      )
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

  async function submitFollowup() {
    if (
      !taskId ||
      !isReady ||
      (!chatUi.draft.trim() && pendingImages.length === 0) ||
      isBreaking
    ) {
      return
    }

    const nextPrompt = chatUi.draft.trim()
    const pendingPromptLabel = describePendingPrompt(nextPrompt, pendingImages.length)
    useTasksSessionStore.getState().setPendingPrompt(taskId, {
      content: pendingPromptLabel,
      baselineSequence: lastSequence,
    })

    try {
      const uploadedImages = await Promise.all(
        pendingImages.map(async (item) => {
          const dataBase64 = await fileToBase64(item.file)
          return storeTaskInputImage(projectId, {
            name: item.file.name,
            mediaType: item.file.type || "image/png",
            dataBase64,
          })
        }),
      )

      await followupMutation.mutateAsync({
        taskId,
        input: [
          ...(nextPrompt
            ? [
                {
                  type: "text" as const,
                  text: nextPrompt,
                },
              ]
            : []),
          ...uploadedImages.map((item) => ({
            type: "local_image" as const,
            path: item.path,
          })),
        ],
        model:
          sanitizedFollowupSelection.mode === "custom"
            ? sanitizedFollowupSelection.model ?? undefined
            : undefined,
        modelSource:
          sanitizedFollowupSelection.mode === "custom"
            ? undefined
            : sanitizedFollowupSelection.mode,
      })

      useTasksSessionStore.getState().setDraft(taskId, "")
      setPendingImages((current) => {
        for (const item of current) {
          URL.revokeObjectURL(item.previewUrl)
        }

        return []
      })
    } catch {
      useTasksSessionStore.getState().setPendingPrompt(taskId, null)
    }
  }

  function removePendingImage(id: string) {
    setPendingImages((current) => {
      const next = current.filter((item) => item.id !== id)
      const removed = current.find((item) => item.id === id)
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl)
      }
      return next
    })
  }

  function appendPendingImages(files: File[]) {
    if (files.length === 0) {
      return
    }

    const acceptedFiles = files.filter((file) =>
      ACCEPTED_IMAGE_MEDIA_TYPES.has(file.type),
    )

    if (acceptedFiles.length === 0) {
      return
    }

    setPendingImages((current) => [
      ...current,
      ...acceptedFiles.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ])
  }

  function handleImageSelection(files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    appendPendingImages(Array.from(files))
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
                            setConversationWindowStart((current) =>
                              Math.max(0, current - CHAT_WINDOW_EXPAND_STEP),
                            )
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

            <form className="min-h-0" onSubmit={handleSubmit}>
              <ChatInteraction
                canSubmit={
                  Boolean(taskId) &&
                  isReady &&
                  (chatUi.draft.trim().length > 0 || pendingImages.length > 0) &&
                  !isBreaking
                }
                actionMode={detail?.status === "running" ? "break" : "send"}
                actionDisabled={
                  detail?.status === "running"
                    ? isBreaking
                    : !(
                        Boolean(taskId) &&
                        isReady &&
                        (chatUi.draft.trim().length > 0 || pendingImages.length > 0) &&
                        !isBreaking
                      )
                }
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
                placeholder={taskId ? "Continue this chat..." : "Select a task first"}
                value={chatUi.draft}
                attachments={
                  pendingImages.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {pendingImages.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded-md bg-background/38 px-2 py-2"
                        >
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="size-10 rounded-md object-cover"
                          />
                          <div className="min-w-0">
                            <p className="max-w-40 truncate font-mono text-[11px] font-medium">
                              {item.file.name}
                            </p>
                            <p className="text-muted-foreground font-mono text-[11px]">
                              {(item.file.size / 1024).toFixed(0)} KB
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removePendingImage(item.id)}
                            disabled={followupMutation.isPending || isBreaking}
                            aria-label={`Remove ${item.file.name}`}
                          >
                            <XIcon className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null
                }
                controls={
                  taskId && detail ? (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          handleImageSelection(event.target.files)
                          event.target.value = ""
                        }}
                      />

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="rounded-md border-border/40 bg-background/50 shadow-none"
                                disabled={
                                  !taskId ||
                                  !detail.threadId ||
                                  followupMutation.isPending ||
                                  isBreaking
                                }
                                onClick={() => fileInputRef.current?.click()}
                                aria-label="Add context"
                              >
                                <PlusIcon className="size-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Add images
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-md border-border/40 bg-background/50 px-3 font-mono text-[11px] font-medium shadow-none"
                            disabled={followupMutation.isPending || isBreaking}
                          >
                            <BotIcon className="size-3.5" />
                            <span className="max-w-52 truncate">
                              {sanitizedFollowupSelection.mode === "custom" &&
                              sanitizedFollowupSelection.model
                                ? sanitizedFollowupSelection.model
                                : sanitizedFollowupSelection.mode === "runtime-default"
                                  ? "Runtime Default"
                                  : formatModelSummary(detail.model)}
                            </span>
                            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-80 rounded-xl border-border/60 bg-background/95 p-2">
                          <DropdownMenuLabel className="font-mono text-[11px] text-muted-foreground">
                            Follow-up model
                          </DropdownMenuLabel>
                          <DropdownMenuRadioGroup
                            value={
                              sanitizedFollowupSelection.mode === "custom" &&
                              sanitizedFollowupSelection.model
                                ? `custom:${sanitizedFollowupSelection.model}`
                                : sanitizedFollowupSelection.mode
                            }
                            onValueChange={(nextValue) => {
                              if (nextValue === "task-default" || nextValue === "runtime-default") {
                                setFollowupSelection({
                                  taskId,
                                  mode: nextValue,
                                  model: null,
                                })
                                return
                              }

                              if (nextValue.startsWith("custom:")) {
                                setFollowupSelection({
                                  taskId,
                                  mode: "custom",
                                  model: nextValue.slice("custom:".length) || null,
                                })
                              }
                            }}
                          >
                            <DropdownMenuRadioItem value="task-default">
                              {`Current task setting (${formatModelSummary(detail.model)})`}
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="runtime-default">
                              Runtime Default
                            </DropdownMenuRadioItem>
                            {selectedExecutorModels.length > 0 ? <DropdownMenuSeparator /> : null}
                            {selectedExecutorModels.map((model) => (
                              <DropdownMenuRadioItem
                                key={model.id}
                                value={`custom:${model.id}`}
                              >
                                {model.isDefault
                                  ? `${model.displayName} (${model.id}, default)`
                                  : `${model.displayName} (${model.id})`}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <span className="inline-flex h-8 items-center gap-2 rounded-md bg-background/35 px-3 font-mono text-[11px] font-medium text-foreground/80">
                        <WifiIcon className="size-3.5 text-muted-foreground" />
                        <span>{formatExecutionModeLabel(detail.executionMode)}</span>
                      </span>

                      {agentCapabilitiesQuery.isLoading ? (
                        <span className="text-muted-foreground font-mono text-[11px]">
                          Loading model options...
                        </span>
                      ) : null}

                      {agentCapabilitiesQuery.isError ? (
                        <span className="text-muted-foreground font-mono text-[11px]">
                          Model list unavailable. You can still use the current task setting.
                        </span>
                      ) : null}

                      {pendingImages.length > 0 ? (
                        <span className="text-muted-foreground inline-flex items-center gap-1 font-mono text-[11px]">
                          <ImageIcon className="size-3.5" />
                          {pendingImages.length} image
                          {pendingImages.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </>
                  ) : null
                }
                footer={null}
                errorMessage={
                  breakTurnMutation.isError
                    ? getErrorMessage(breakTurnMutation.error)
                    : followupMutation.isError
                      ? getErrorMessage(followupMutation.error)
                      : null
                }
                onChange={updateDraft}
                onPasteFiles={appendPendingImages}
                onDropFiles={appendPendingImages}
                onAction={() => {
                  if (detail?.status === "running") {
                    void handleBreakTurn()
                    return
                  }

                  void submitFollowup()
                }}
                onSubmit={() => {
                  void submitFollowup()
                }}
              />
            </form>
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
