import {
  selectChatUi,
  selectTaskEventStream,
  type TasksSessionState,
} from "@/modules/tasks/store"
import {
  extractTaskInputAttachments,
  extractTaskInputText,
} from "@/modules/tasks/lib"

import type {
  ChatConversationBlock,
  ChatInspectorBlock,
} from "./conversation-blocks"
import {
  appendConversationBlocks,
  toConversationBlocks,
} from "./to-conversation-blocks"

const EMPTY_TASK_EVENTS: never[] = []

const conversationBlocksCache = new Map<
  string,
  {
    baseResult: ChatConversationBlock[]
    stream: ReturnType<typeof selectTaskEventStream>
    pendingPrompt: ReturnType<typeof selectChatUi>["pendingPrompt"]
    result: ChatConversationBlock[]
  }
>()

function buildConversationResult(
  baseResult: ChatConversationBlock[],
  pendingPrompt: ReturnType<typeof selectChatUi>["pendingPrompt"],
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
      content: extractTaskInputText(pendingPrompt.input),
      attachments: extractTaskInputAttachments(pendingPrompt.input),
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

export function selectConversationBlocks(
  state: TasksSessionState,
  taskId: string | null,
): ChatConversationBlock[] {
  const cacheKey = taskId ?? "__null__"
  const stream = selectTaskEventStream(state, taskId)
  const pendingPrompt = selectChatUi(state, taskId).pendingPrompt
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
): ChatInspectorBlock | null {
  const inspectorBlockId = selectChatUi(state, taskId).selectedInspectorBlockId
  if (!inspectorBlockId) {
    return null
  }

  const block = selectConversationBlocks(state, taskId).find(
    (item): item is ChatInspectorBlock =>
      (item.type === "file-change" ||
        item.type === "web-search" ||
        item.type === "mcp-tool-call" ||
        item.type === "command-group") &&
      item.id === inspectorBlockId,
  )

  return block ?? null
}
