import {
  appendConversationBlocks,
  toConversationBlocks,
} from "@/modules/tasks/features/task-session/mappers/to-conversation-blocks"
import type { ChatConversationBlock } from "@/modules/tasks/features/task-session/types"
import type { TaskAgentEvent } from "@/modules/tasks/contracts"

import type {
  ChatUiState,
  SelectedInspectorBlock,
  TaskRecord,
  TasksSessionState,
} from "./task-session.types"

const DEFAULT_CHAT_UI: ChatUiState = {
  draft: "",
  pendingPrompt: null,
  queuedPrompt: null,
  stickToBottom: true,
  selectedInspectorBlockId: null,
}

const EMPTY_PROJECT_TASKS: TaskRecord[] = []
const EMPTY_TASK_EVENTS: TaskAgentEvent[] = []

const projectTasksCache = new Map<
  string,
  {
    taskIds: string[]
    tasksById: TasksSessionState["tasksById"]
    result: TaskRecord[]
  }
>()

const conversationBlocksCache = new Map<
  string,
  {
    baseResult: ChatConversationBlock[]
    stream: ReturnType<typeof selectTaskEventStream>
    pendingPrompt: ChatUiState["pendingPrompt"]
    result: ChatConversationBlock[]
  }
>()

function buildConversationResult(
  baseResult: ChatConversationBlock[],
  pendingPrompt: ChatUiState["pendingPrompt"],
) {
  if (!pendingPrompt) {
    return baseResult
  }

  return [
    ...baseResult,
    {
      id: `pending-${pendingPrompt.baselineSequence}`,
      type: "message" as const,
      role: "user" as const,
      content: pendingPrompt.content,
      timestamp: null,
      pending: true,
    },
  ]
}

function isStreamAppendOnly(
  previous: ReturnType<typeof selectTaskEventStream>,
  next: ReturnType<typeof selectTaskEventStream>,
) {
  if (!previous || !next) {
    return false
  }

  const previousLength = previous.items.length
  if (next.items.length <= previousLength) {
    return false
  }

  if (previousLength === 0) {
    return true
  }

  return previous.items[previousLength - 1] === next.items[previousLength - 1]
}

export function selectProjectTasks(
  state: TasksSessionState,
  projectId: string,
) {
  const taskIds = state.taskIdsByProject[projectId] ?? []
  if (taskIds.length === 0) {
    return EMPTY_PROJECT_TASKS
  }

  const cached = projectTasksCache.get(projectId)
  if (cached && cached.taskIds === taskIds && cached.tasksById === state.tasksById) {
    return cached.result
  }

  const result = taskIds
    .map((taskId) => state.tasksById[taskId])
    .filter((task): task is NonNullable<typeof task> => Boolean(task))

  projectTasksCache.set(projectId, {
    taskIds,
    tasksById: state.tasksById,
    result,
  })

  return result
}

export function selectTaskDetail(
  state: TasksSessionState,
  taskId: string | null,
) {
  if (!taskId) {
    return null
  }

  return state.tasksById[taskId] ?? null
}

export function selectTaskEventStream(
  state: TasksSessionState,
  taskId: string | null,
) {
  if (!taskId) {
    return null
  }

  return state.eventStreamsByTaskId[taskId] ?? null
}

export function selectTaskEvents(
  state: TasksSessionState,
  taskId: string | null,
) {
  return selectTaskEventStream(state, taskId)?.items ?? EMPTY_TASK_EVENTS
}

export function selectChatUi(
  state: TasksSessionState,
  taskId: string | null,
) {
  if (!taskId) {
    return DEFAULT_CHAT_UI
  }

  return state.chatUiByTaskId[taskId] ?? DEFAULT_CHAT_UI
}

export function selectLastSequence(
  state: TasksSessionState,
  taskId: string | null,
) {
  return selectTaskEvents(state, taskId).at(-1)?.sequence ?? 0
}

export function selectVisiblePendingPrompt(
  state: TasksSessionState,
  taskId: string | null,
) {
  return selectChatUi(state, taskId).pendingPrompt
}

export function selectConversationBlocks(
  state: TasksSessionState,
  taskId: string | null,
): ChatConversationBlock[] {
  const cacheKey = taskId ?? "__null__"
  const stream = selectTaskEventStream(state, taskId)
  const pendingPrompt = selectVisiblePendingPrompt(state, taskId)
  const cached = conversationBlocksCache.get(cacheKey)

  if (cached && cached.stream === stream && cached.pendingPrompt === pendingPrompt) {
    return cached.result
  }

  const events = stream?.items ?? EMPTY_TASK_EVENTS
  const baseResult =
    cached && cached.pendingPrompt === pendingPrompt && isStreamAppendOnly(cached.stream, stream)
      ? appendConversationBlocks(cached.baseResult, events.slice(cached.stream?.items.length ?? 0))
      : toConversationBlocks(events)
  const result = buildConversationResult(baseResult, pendingPrompt)

  conversationBlocksCache.set(cacheKey, {
    baseResult,
    stream,
    pendingPrompt,
    result,
  })

  return result
}

export function selectSelectedInspectorBlock(
  state: TasksSessionState,
  taskId: string | null,
): SelectedInspectorBlock | null {
  const inspectorBlockId = selectChatUi(state, taskId).selectedInspectorBlockId
  if (!inspectorBlockId) {
    return null
  }

  const block = selectConversationBlocks(state, taskId).find(
    (item): item is SelectedInspectorBlock =>
      (item.type === "file-change" ||
        item.type === "web-search" ||
        item.type === "mcp-tool-call" ||
        item.type === "command-group") &&
      item.id === inspectorBlockId,
  )

  return block ?? null
}
