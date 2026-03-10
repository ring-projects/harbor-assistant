"use client"

import {
  PlusIcon,
  RefreshCcwIcon,
  SearchIcon,
  SendHorizonalIcon,
  XIcon,
} from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  filterTasksByKeyword,
  filterTasksByStatus,
  filterTasksByTimeRange,
  useCreateTaskMutation,
  useTaskConversationQuery,
  useTaskDetailQuery,
  useTaskEventsQuery,
  useTaskFollowupMutation,
  useTaskListQuery,
} from "@/modules/tasks/hooks/use-task-queries"
import {
  TASK_STATUS_VALUES,
  TASK_TIME_RANGE_VALUES,
  type TaskDetail,
  type TaskEvent,
  type TaskFilter,
  type TaskStatus,
  type TaskTimeRange,
} from "@/modules/tasks/types/task-contract"

type TaskWorkbenchProps = {
  projectId: string
}

const STATUS_META: Record<
  TaskStatus,
  {
    label: string
    badgeClassName: string
  }
> = {
  queued: {
    label: "Queued",
    badgeClassName: "bg-slate-100 text-slate-700 border-slate-200",
  },
  running: {
    label: "Running",
    badgeClassName: "bg-blue-100 text-blue-700 border-blue-200",
  },
  completed: {
    label: "Completed",
    badgeClassName: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  failed: {
    label: "Failed",
    badgeClassName: "bg-rose-100 text-rose-700 border-rose-200",
  },
  cancelled: {
    label: "Cancelled",
    badgeClassName: "bg-amber-100 text-amber-700 border-amber-200",
  },
}

const TIME_RANGE_LABEL: Record<TaskTimeRange, string> = {
  "24h": "最近 24 小时",
  "7d": "最近 7 天",
  "30d": "最近 30 天",
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "-"
  }

  return parsed.toLocaleString("zh-CN", {
    hour12: false,
  })
}

function truncateTaskId(taskId: string) {
  if (taskId.length <= 14) {
    return taskId
  }

  return `${taskId.slice(0, 8)}...${taskId.slice(-4)}`
}

function getPromptSummary(prompt: string) {
  const summary = prompt.split("\n").find((line) => line.trim().length > 0) ?? prompt
  if (!summary) {
    return "(empty prompt)"
  }

  return summary.length > 100 ? `${summary.slice(0, 100)}...` : summary
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "加载失败，请重试。"
}

function parseSummaryPayload(payload: string) {
  try {
    const parsed = JSON.parse(payload) as {
      stdout?: unknown
      stderr?: unknown
    }
    return {
      stdout: typeof parsed.stdout === "string" ? parsed.stdout : "",
      stderr: typeof parsed.stderr === "string" ? parsed.stderr : "",
    }
  } catch {
    return {
      stdout: "",
      stderr: "",
    }
  }
}

function resolveTaskStreams(args: {
  detail: TaskDetail | null | undefined
  events: TaskEvent[] | undefined
}) {
  const summaryEvent = args.events
    ?.slice()
    .reverse()
    .find((event) => event.type === "summary")

  if (summaryEvent) {
    const parsed = parseSummaryPayload(summaryEvent.payload)
    return {
      stdout: parsed.stdout || args.detail?.stdout || "",
      stderr: parsed.stderr || args.detail?.stderr || "",
    }
  }

  return {
    stdout: args.detail?.stdout || "",
    stderr: args.detail?.stderr || "",
  }
}

function extractDiffBlocks(text: string) {
  if (!text.trim()) {
    return []
  }

  const blocks: string[] = []

  const fencedDiff = /```diff\s*([\s\S]*?)```/g
  for (const match of text.matchAll(fencedDiff)) {
    const content = match[1]?.trim()
    if (content) {
      blocks.push(content)
    }
  }

  const lines = text.split(/\r?\n/)
  let currentBlock: string[] = []

  function flushCurrentBlock() {
    if (currentBlock.length === 0) {
      return
    }

    const merged = currentBlock.join("\n").trim()
    if (merged.length > 0) {
      blocks.push(merged)
    }

    currentBlock = []
  }

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      flushCurrentBlock()
      currentBlock.push(line)
      continue
    }

    if (currentBlock.length > 0) {
      currentBlock.push(line)
    }
  }

  flushCurrentBlock()

  return blocks
}

function extractChangedFiles(diffBlocks: string[]) {
  const files = new Set<string>()

  for (const block of diffBlocks) {
    for (const line of block.split("\n")) {
      if (line.startsWith("diff --git ")) {
        const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
        if (match?.[2]) {
          files.add(match[2].trim())
        }
        continue
      }

      if (line.startsWith("+++ b/")) {
        files.add(line.slice("+++ b/".length).trim())
      }
    }
  }

  return Array.from(files)
}

type TimelineEntry =
  | {
      id: string
      kind: "message"
      timestamp: string | null
      sortTime: number
      taskId: string
      role: "user" | "assistant" | "system"
      label: string
      content: string
      source: string
    }
  | {
      id: string
      kind: "event"
      timestamp: string | null
      sortTime: number
      taskId: string
      eventType: TaskEvent["type"]
      label: string
      content: string
    }

function toSortableTime(value: string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime()
}

function formatTaskEventContent(event: TaskEvent) {
  if (event.type === "state") {
    try {
      const parsed = JSON.parse(event.payload) as {
        from?: unknown
        to?: unknown
      }
      const from = typeof parsed.from === "string" ? parsed.from : "unknown"
      const to = typeof parsed.to === "string" ? parsed.to : "unknown"
      return `状态变化：${from} → ${to}`
    } catch {
      return event.payload
    }
  }

  if (event.type === "summary") {
    const parsed = parseSummaryPayload(event.payload)
    const chunks = [parsed.stdout, parsed.stderr].filter(Boolean)
    return chunks.join("\n\n").trim() || event.payload
  }

  if (event.type === "system") {
    try {
      const parsed = JSON.parse(event.payload) as {
        kind?: unknown
        threadId?: unknown
        status?: unknown
        command?: unknown
        exitCode?: unknown
      }

      if (parsed.kind === "codex-thread" && typeof parsed.threadId === "string") {
        return `线程已建立：${parsed.threadId}`
      }

      if (
        parsed.kind === "command_execution" &&
        typeof parsed.command === "string"
      ) {
        const status = typeof parsed.status === "string" ? parsed.status : "completed"
        const exitCode =
          typeof parsed.exitCode === "number" ? ` (exit ${String(parsed.exitCode)})` : ""
        return `命令${status}：${parsed.command}${exitCode}`
      }

      return JSON.stringify(parsed, null, 2)
    } catch {
      return event.payload
    }
  }

  return event.payload
}

function mergeTimelineEntries(args: {
  messages: Array<{
    id: string
    taskId: string
    role: "user" | "assistant" | "system"
    content: string
    timestamp: string | null
    source: string
  }>
  events: TaskEvent[]
}) {
  const messageEntries: TimelineEntry[] = args.messages.map((message) => ({
    id: `message:${message.id}`,
    kind: "message",
    timestamp: message.timestamp,
    sortTime: toSortableTime(message.timestamp),
    taskId: message.taskId,
    role: message.role,
    label: message.role,
    content: message.content,
    source: message.source,
  }))

  const eventEntries: TimelineEntry[] = args.events
    .filter((event) => event.type !== "summary")
    .map((event) => ({
      id: `event:${event.id}`,
      kind: "event",
      timestamp: event.createdAt,
      sortTime: toSortableTime(event.createdAt),
      taskId: event.taskId,
      eventType: event.type,
      label: event.type,
      content: formatTaskEventContent(event),
    }))

  return [...messageEntries, ...eventEntries].sort((left, right) => {
    if (left.sortTime !== right.sortTime) {
      return left.sortTime - right.sortTime
    }

    return left.id.localeCompare(right.id)
  })
}

function TaskConversationPanel(props: {
  projectId: string
  taskId: string | null
  onSelectTask: (taskId: string) => void
}) {
  const conversationQuery = useTaskConversationQuery({
    taskId: props.taskId,
    enabled: Boolean(props.taskId),
  })
  const eventsQuery = useTaskEventsQuery({
    taskId: props.taskId,
    enabled: Boolean(props.taskId),
  })
  const followupMutation = useTaskFollowupMutation(props.projectId)
  const [prompt, setPrompt] = useState("")

  const conversation = conversationQuery.data
  const canSubmit = Boolean(props.taskId) && prompt.trim().length > 0
  const timelineEntries = useMemo(
    () =>
      mergeTimelineEntries({
        messages: conversation?.messages ?? [],
        events: eventsQuery.data ?? [],
      }),
    [conversation?.messages, eventsQuery.data],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!props.taskId || !prompt.trim()) {
      return
    }

    const nextPrompt = prompt.trim()
    try {
      const result = await followupMutation.mutateAsync({
        taskId: props.taskId,
        prompt: nextPrompt,
      })

      setPrompt("")
      props.onSelectTask(result.taskId)
    } catch {
    }
  }

  return (
    <Card className="h-full min-h-0 overflow-hidden p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Chat</p>
            <p className="text-muted-foreground text-xs">
              Codex 线程消息（直接来自服务端数据库）
            </p>
          </div>

          {conversation?.threadId ? (
            <span className="text-muted-foreground rounded border px-2 py-0.5 font-mono text-[11px]">
              {truncateTaskId(conversation.threadId)}
            </span>
          ) : null}
        </div>

        {!props.taskId ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-md border border-dashed text-xs">
            请选择左侧任务
          </div>
        ) : null}

        {props.taskId && (conversationQuery.isLoading || eventsQuery.isLoading) ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-md" />
            ))}
          </div>
        ) : null}

        {props.taskId && (conversationQuery.isError || eventsQuery.isError) ? (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
            {getErrorMessage(conversationQuery.error ?? eventsQuery.error)}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
          {props.taskId &&
          !conversationQuery.isLoading &&
          !eventsQuery.isLoading &&
          !conversationQuery.isError &&
          !eventsQuery.isError ? (
            <Tabs defaultValue="chat" className="flex h-full min-h-0 flex-col gap-0">
              <div className="border-b p-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chat" className="min-h-0 flex-1 overflow-hidden">
                {!conversation || conversation.messages.length === 0 ? (
                  <div className="text-muted-foreground flex h-full items-center justify-center border-dashed text-xs">
                    当前任务暂无可读取会话记录。
                  </div>
                ) : (
                  <div className="h-full space-y-2 overflow-x-auto overflow-y-auto p-3 pr-2">
                    {conversation.messages.map((message) => (
                      <div key={message.id} className="rounded-md border p-2.5">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px]",
                              message.role === "assistant"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : message.role === "user"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700",
                            )}
                          >
                            {message.role}
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            {formatDateTime(message.timestamp)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-xs leading-5">
                          {message.content}
                        </p>
                      </div>
                    ))}
                    {conversation.truncated ? (
                      <p className="text-muted-foreground text-xs">
                        仅显示最近部分会话内容。
                      </p>
                    ) : null}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="min-h-0 flex-1 overflow-hidden">
                {timelineEntries.length === 0 ? (
                  <div className="text-muted-foreground flex h-full items-center justify-center border-dashed text-xs">
                    当前任务暂无可回放的时间线数据。
                  </div>
                ) : (
                  <div className="h-full space-y-2 overflow-x-auto overflow-y-auto p-3 pr-2">
                    {timelineEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className={cn(
                          "rounded-md border p-2.5",
                          entry.kind === "message"
                            ? "bg-background"
                            : entry.eventType === "stdout"
                              ? "border-sky-200 bg-sky-50/70"
                              : entry.eventType === "stderr"
                                ? "border-rose-200 bg-rose-50/70"
                                : entry.eventType === "state"
                                  ? "border-violet-200 bg-violet-50/70"
                                  : "border-slate-200 bg-slate-50/70",
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2 py-0.5 text-[11px]",
                                entry.kind === "message"
                                  ? entry.role === "assistant"
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : entry.role === "user"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-slate-200 bg-slate-50 text-slate-700"
                                  : "border-slate-300 bg-white/70 text-slate-700",
                              )}
                            >
                              {entry.label}
                            </span>
                            <span className="text-muted-foreground font-mono text-[11px]">
                              {truncateTaskId(entry.taskId)}
                            </span>
                          </div>
                          <span className="text-muted-foreground text-[11px]">
                            {formatDateTime(entry.timestamp)}
                          </span>
                        </div>
                        <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5">
                          {entry.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : null}
        </div>

        <form className="grid gap-2 border-t pt-3" onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={props.taskId ? "继续这个线程…" : "请先选择任务"}
            disabled={!props.taskId || followupMutation.isPending}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-[92px] w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60"
          />

          {followupMutation.isError ? (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
              {getErrorMessage(followupMutation.error)}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-[11px]">
              Follow-up 会在同一线程继续对话，并生成新的 task 记录。
            </p>
            <Button type="submit" size="sm" disabled={!canSubmit || followupMutation.isPending}>
              <SendHorizonalIcon className="size-4" />
              {followupMutation.isPending ? "发送中..." : "发送"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  )
}

function TaskDiffPanel(props: { taskId: string | null }) {
  const detailQuery = useTaskDetailQuery(props.taskId)
  const eventsQuery = useTaskEventsQuery({
    taskId: props.taskId,
    enabled: Boolean(props.taskId),
  })

  const streams = useMemo(
    () =>
      resolveTaskStreams({
        detail: detailQuery.data,
        events: eventsQuery.data,
      }),
    [detailQuery.data, eventsQuery.data],
  )

  const diffBlocks = useMemo(
    () => [
      ...extractDiffBlocks(streams.stdout),
      ...extractDiffBlocks(streams.stderr),
    ],
    [streams.stderr, streams.stdout],
  )

  const changedFiles = useMemo(
    () => extractChangedFiles(diffBlocks),
    [diffBlocks],
  )

  const outputPreview = useMemo(() => {
    const combined = `${streams.stdout}\n${streams.stderr}`.trim()
    if (!combined) {
      return ""
    }

    if (combined.length <= 2_000) {
      return combined
    }

    return combined.slice(combined.length - 2_000)
  }, [streams.stderr, streams.stdout])

  return (
    <Card className="min-h-0 p-3">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div>
          <p className="text-sm font-semibold">Diff</p>
          <p className="text-muted-foreground text-xs">任务详情与变更预览</p>
        </div>

        {!props.taskId ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center rounded-md border border-dashed text-xs">
            请选择左侧任务
          </div>
        ) : null}

        {props.taskId && (detailQuery.isLoading || eventsQuery.isLoading) ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-md" />
            ))}
          </div>
        ) : null}

        {props.taskId && (detailQuery.isError || eventsQuery.isError) ? (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
            {getErrorMessage(detailQuery.error ?? eventsQuery.error)}
          </div>
        ) : null}

        {props.taskId &&
        !detailQuery.isLoading &&
        !eventsQuery.isLoading &&
        !detailQuery.isError &&
        !eventsQuery.isError &&
        detailQuery.data ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">状态</p>
                <p className="pt-1">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5",
                      STATUS_META[detailQuery.data.status].badgeClassName,
                    )}
                  >
                    {STATUS_META[detailQuery.data.status].label}
                  </span>
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">退出码</p>
                <p className="pt-1 font-mono">
                  {detailQuery.data.exitCode === null
                    ? "-"
                    : String(detailQuery.data.exitCode)}
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">开始</p>
                <p className="pt-1">{formatDateTime(detailQuery.data.startedAt)}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">结束</p>
                <p className="pt-1">{formatDateTime(detailQuery.data.finishedAt)}</p>
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
    </Card>
  )
}

export function TaskWorkbench({ projectId }: TaskWorkbenchProps) {
  const [selectedTaskIdState, setSelectedTaskIdState] = useState<string | null>(null)
  const [isCreateComposerOpen, setIsCreateComposerOpen] = useState(false)
  const [newTaskPrompt, setNewTaskPrompt] = useState("")
  const [createTaskError, setCreateTaskError] = useState<string | null>(null)
  const [filter, setFilter] = useState<TaskFilter>({
    statuses: [...TASK_STATUS_VALUES],
    timeRange: "7d",
    keyword: "",
  })
  const createTaskMutation = useCreateTaskMutation(projectId)

  const listQuery = useTaskListQuery({
    projectId,
  })

  const allTasks = useMemo(() => {
    const tasks = listQuery.data ?? []
    return [...tasks].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
  }, [listQuery.data])

  const filteredTasks = useMemo(() => {
    const byTime = filterTasksByTimeRange(allTasks, filter.timeRange)
    const byKeyword = filterTasksByKeyword(byTime, filter.keyword)
    return filterTasksByStatus(byKeyword, filter.statuses)
  }, [allTasks, filter.keyword, filter.statuses, filter.timeRange])

  const selectedTaskId = useMemo(() => {
    if (filteredTasks.length === 0) {
      return null
    }

    if (
      selectedTaskIdState &&
      filteredTasks.some((task) => task.taskId === selectedTaskIdState)
    ) {
      return selectedTaskIdState
    }

    return filteredTasks[0].taskId
  }, [filteredTasks, selectedTaskIdState])

  function toggleStatus(status: TaskStatus) {
    setFilter((current) => {
      const hasStatus = current.statuses.includes(status)
      if (hasStatus && current.statuses.length === 1) {
        return current
      }

      if (hasStatus) {
        return {
          ...current,
          statuses: current.statuses.filter((item) => item !== status),
        }
      }

      return {
        ...current,
        statuses: [...current.statuses, status],
      }
    })
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const prompt = newTaskPrompt.trim()
    if (!prompt) {
      setCreateTaskError("请输入初始化 prompt。")
      return
    }

    try {
      setCreateTaskError(null)
      const result = await createTaskMutation.mutateAsync({
        prompt,
      })

      setNewTaskPrompt("")
      setIsCreateComposerOpen(false)
      setSelectedTaskIdState(result.taskId)
    } catch (error) {
      setCreateTaskError(getErrorMessage(error))
    }
  }

  return (
    <div className="h-full min-h-0 w-full max-w-full overflow-hidden p-3">
      <div className="grid h-full min-h-0 w-full max-w-full grid-cols-1 gap-3 xl:grid-cols-[360px_minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="min-h-0 p-3">
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Task List</p>
                <p className="text-muted-foreground text-xs">新建任务会开启一个新的 Codex thread</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isCreateComposerOpen ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setCreateTaskError(null)
                    setIsCreateComposerOpen((current) => !current)
                  }}
                >
                  {isCreateComposerOpen ? (
                    <XIcon className="size-4" />
                  ) : (
                    <PlusIcon className="size-4" />
                  )}
                  {isCreateComposerOpen ? "收起" : "New Task"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => listQuery.refetch()}
                  disabled={listQuery.isFetching}
                >
                  <RefreshCcwIcon className={cn(listQuery.isFetching && "animate-spin")} />
                  刷新
                </Button>
              </div>
            </div>

            {isCreateComposerOpen ? (
              <form
                className="grid gap-2 rounded-md border bg-muted/20 p-3"
                onSubmit={handleCreateTask}
              >
                <Input
                  value={newTaskPrompt}
                  onChange={(event) => setNewTaskPrompt(event.target.value)}
                  placeholder="输入初始化 prompt，开始一个新的 thread"
                  disabled={createTaskMutation.isPending}
                />

                {createTaskError ? (
                  <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700">
                    {createTaskError}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted-foreground text-[11px]">
                    这里创建的是新任务，不会复用当前选中任务的线程。
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCreateComposerOpen(false)
                        setCreateTaskError(null)
                        setNewTaskPrompt("")
                      }}
                      disabled={createTaskMutation.isPending}
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={createTaskMutation.isPending || newTaskPrompt.trim().length === 0}
                    >
                      <PlusIcon className="size-4" />
                      {createTaskMutation.isPending ? "创建中..." : "创建"}
                    </Button>
                  </div>
                </div>
              </form>
            ) : null}

            <div className="grid gap-2">
              <div className="flex flex-wrap gap-1.5">
                {TASK_STATUS_VALUES.map((status) => {
                  const isActive = filter.statuses.includes(status)
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => toggleStatus(status)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition-colors",
                        isActive
                          ? STATUS_META[status].badgeClassName
                          : "text-muted-foreground bg-background border-dashed",
                      )}
                    >
                      {STATUS_META[status].label}
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={filter.timeRange}
                  onChange={(event) =>
                    setFilter((current) => ({
                      ...current,
                      timeRange: event.target.value as TaskTimeRange,
                    }))
                  }
                  className="border-input h-9 rounded-md border px-2 text-sm"
                >
                  {TASK_TIME_RANGE_VALUES.map((range) => (
                    <option key={range} value={range}>
                      {TIME_RANGE_LABEL[range]}
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                  <Input
                    value={filter.keyword}
                    onChange={(event) =>
                      setFilter((current) => ({
                        ...current,
                        keyword: event.target.value,
                      }))
                    }
                    className="pl-8"
                    placeholder="关键词"
                  />
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
              {listQuery.isLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full rounded-md" />
                ))
              ) : null}

              {!listQuery.isLoading && listQuery.isError ? (
                <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
                  {getErrorMessage(listQuery.error)}
                </div>
              ) : null}

              {!listQuery.isLoading &&
              !listQuery.isError &&
              filteredTasks.length === 0 ? (
                <div className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                  当前筛选条件下没有任务。
                </div>
              ) : null}

              {!listQuery.isLoading && !listQuery.isError
                ? filteredTasks.map((task) => {
                    const isActive = task.taskId === selectedTaskId

                    return (
                      <button
                        key={task.taskId}
                        type="button"
                        onClick={() => setSelectedTaskIdState(task.taskId)}
                        className={cn(
                          "w-full rounded-md border p-3 text-left transition-colors",
                          isActive
                            ? "border-primary bg-primary/5"
                            : "hover:border-muted-foreground/40",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-xs">{truncateTaskId(task.taskId)}</p>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px]",
                              STATUS_META[task.status].badgeClassName,
                            )}
                          >
                            {STATUS_META[task.status].label}
                          </span>
                        </div>

                        <p className="pt-2 text-sm">{getPromptSummary(task.prompt)}</p>

                        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 pt-2 text-[11px]">
                          <span>创建：{formatDateTime(task.createdAt)}</span>
                          <span>Model：{task.model ?? "-"}</span>
                        </div>
                      </button>
                    )
                  })
                : null}
            </div>
          </div>
        </Card>

        <TaskConversationPanel
          projectId={projectId}
          taskId={selectedTaskId}
          onSelectTask={setSelectedTaskIdState}
        />

        <TaskDiffPanel taskId={selectedTaskId} />
      </div>
    </div>
  )
}
