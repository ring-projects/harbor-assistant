import type { TaskAgentEvent } from "@/modules/tasks/contracts"

import type { ChatConversationBlock } from "./conversation-blocks"

const HIDDEN_EVENT_TYPES = new Set<TaskAgentEvent["eventType"]>([
  "session.started",
  "session.completed",
  "turn.started",
  "turn.completed",
])

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" ? value : null
}

function eventTimestamp(event: TaskAgentEvent) {
  const payload = asRecord(event.payload)
  const rawTimestamp = toStringOrNull(payload?.timestamp)
  return rawTimestamp ?? event.createdAt
}

function formatTodoList(payload: Record<string, unknown> | null) {
  const items = Array.isArray(payload?.items) ? payload.items : []
  const lines = items
    .map((item) => {
      const source = asRecord(item)
      if (!source) {
        return null
      }

      const text = toStringOrNull(source.text)
      if (!text) {
        return null
      }

      const completed = source.completed === true
      return `${completed ? "[x]" : "[ ]"} ${text}`
    })
    .filter((line): line is string => Boolean(line))

  return lines.join("\n")
}

function parseTodoListItems(payload: Record<string, unknown> | null) {
  const items = Array.isArray(payload?.items) ? payload.items : []

  return items
    .map((item) => {
      const source = asRecord(item)
      if (!source) {
        return null
      }

      const text = toStringOrNull(source.text)
      if (!text) {
        return null
      }

      return {
        text,
        completed: source.completed === true,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

function formatCommandCompleted(payload: Record<string, unknown> | null) {
  const status = toStringOrNull(payload?.status) ?? "unknown"
  const exitCode =
    typeof payload?.exitCode === "number" ? String(payload.exitCode) : null

  return exitCode ? `${status} (exit ${exitCode})` : status
}

function stringifyPretty(value: unknown) {
  if (typeof value === "string") {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function countOutputLines(output: string) {
  const trimmed = output.trim()
  if (!trimmed) {
    return 0
  }

  return trimmed.split(/\r?\n/).length
}

function previewOutput(output: string, maxLines: number) {
  const trimmed = output.trim()
  if (!trimmed) {
    return null
  }

  const lines = trimmed.split(/\r?\n/)
  if (lines.length <= maxLines) {
    return trimmed
  }

  return `${lines.slice(0, maxLines).join("\n")}\n...`
}

function updateCommandOutputMeta(
  group: Extract<ChatConversationBlock, { type: "command-group" }>,
) {
  group.outputLineCount = countOutputLines(group.output)
  group.outputPreview = previewOutput(group.output, 4)
  group.hasMoreOutput = group.outputLineCount > 4
}

function formatFileChanges(payload: Record<string, unknown> | null) {
  const status = toStringOrNull(payload?.status) ?? "unknown"
  const changes = Array.isArray(payload?.changes) ? payload.changes : []
  const lines = changes
    .map((item) => {
      const source = asRecord(item)
      if (!source) {
        return null
      }

      const kind = toStringOrNull(source.kind) ?? "update"
      const path = toStringOrNull(source.path)
      if (!path) {
        return null
      }

      return `${kind} ${path}`
    })
    .filter((line): line is string => Boolean(line))

  return [status, ...lines].join("\n")
}

function formatMcpToolCall(payload: Record<string, unknown> | null) {
  const server = toStringOrNull(payload?.server) ?? "mcp"
  const tool = toStringOrNull(payload?.tool) ?? "tool"
  const status = toStringOrNull(payload?.status)
  const args = payload?.arguments
  const result = payload?.result
  const error = toStringOrNull(payload?.error)

  const sections = [`${server}.${tool}`]

  if (status) {
    sections.push(`status: ${status}`)
  }

  if (args !== undefined) {
    sections.push(`arguments:\n${stringifyPretty(args)}`)
  }

  if (result !== undefined) {
    sections.push(`result:\n${stringifyPretty(result)}`)
  }

  if (error) {
    sections.push(`error:\n${error}`)
  }

  return sections.join("\n\n")
}

function parseFileChanges(
  payload: Record<string, unknown> | null,
): Array<{ path: string; kind: "add" | "delete" | "update" }> {
  const changes = Array.isArray(payload?.changes) ? payload.changes : []

  return changes
    .map((item) => {
      const source = asRecord(item)
      if (!source) {
        return null
      }

      const path = toStringOrNull(source.path)
      const kind = source.kind
      if (
        !path ||
        (kind !== "add" && kind !== "delete" && kind !== "update")
      ) {
        return null
      }

      const normalizedKind: "add" | "delete" | "update" = kind

      return {
        path,
        kind: normalizedKind,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

function formatUserInputContent(payload: Record<string, unknown> | null) {
  if (!payload) {
    return null
  }

  if (typeof payload.input === "string") {
    const directInput = payload.input.trim()
    return directInput || null
  }

  if (!Array.isArray(payload.input)) {
    return null
  }

  const textBlocks = payload.input
    .map((item) => {
      const source = asRecord(item)
      if (!source || source.type !== "text") {
        return null
      }

      const text = toStringOrNull(source.text)?.trim()
      return text || null
    })
    .filter((item): item is string => Boolean(item))

  const attachmentBlocks = payload.input
    .map((item) => {
      const source = asRecord(item)
      if (!source || source.type !== "local_image") {
        return null
      }

      const imagePath = toStringOrNull(source.path)?.trim()
      return imagePath ? `Attached image: ${imagePath}` : null
    })
    .filter((item): item is string => Boolean(item))

  const blocks = [...textBlocks, ...attachmentBlocks]
  return blocks.length > 0 ? blocks.join("\n") : null
}

function parseUserInputAttachments(payload: Record<string, unknown> | null) {
  if (!payload) {
    return []
  }

  const attachmentSources = Array.isArray(payload.attachments)
    ? payload.attachments
    : Array.isArray(payload.input)
      ? payload.input
      : []

  return attachmentSources
    .map((item) => {
      const source = asRecord(item)
      if (!source || source.type !== "local_image") {
        return null
      }

      const path = toStringOrNull(source.path)?.trim()
      if (!path) {
        return null
      }

      return {
        type: "local_image" as const,
        path,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

function parseUserInputText(payload: Record<string, unknown> | null) {
  if (!payload) {
    return null
  }

  if (typeof payload.input === "string") {
    const directInput = payload.input.trim()
    return directInput || null
  }

  if (!Array.isArray(payload.input)) {
    const content = toStringOrNull(payload.content)?.trim()
    return content || null
  }

  const text = payload.input
    .map((item) => {
      const source = asRecord(item)
      if (!source || source.type !== "text") {
        return null
      }

      const text = toStringOrNull(source.text)?.trim()
      return text || null
    })
    .filter((item): item is string => Boolean(item))
    .join("\n\n")
    .trim()

  if (text) {
    return text
  }

  const content = toStringOrNull(payload.content)?.trim()
  return content || null
}

function eventContent(event: TaskAgentEvent) {
  const payload = asRecord(event.payload)

  switch (event.eventType) {
    case "message":
      return toStringOrNull(payload?.content) ?? "(empty)"
    case "command.started":
      return toStringOrNull(payload?.command) ?? "(empty)"
    case "command.output":
      return toStringOrNull(payload?.output) ?? "(empty)"
    case "command.completed":
      return formatCommandCompleted(payload)
    case "web_search.started":
    case "web_search.completed":
      return toStringOrNull(payload?.query) ?? "(empty)"
    case "file_change":
      return formatFileChanges(payload) || "(empty)"
    case "mcp_tool_call.started":
    case "mcp_tool_call.completed":
      return formatMcpToolCall(payload)
    case "reasoning":
      return toStringOrNull(payload?.content) ?? "(empty)"
    case "todo_list":
    case "todo_list.started":
    case "todo_list.updated":
    case "todo_list.completed":
      return formatTodoList(payload) || "(empty)"
    case "error":
      return toStringOrNull(payload?.message) ?? "(empty)"
    case "turn.failed":
      return toStringOrNull(payload?.error) ?? "(empty)"
    case "session.started":
      return toStringOrNull(payload?.sessionId) ?? "(empty)"
    default:
      return JSON.stringify(event.payload, null, 2)
  }
}

function eventTone(event: TaskAgentEvent): "neutral" | "error" | "success" {
  if (event.eventType === "error" || event.eventType === "turn.failed") {
    return "error"
  }

  return "neutral"
}

function isCommandEvent(event: TaskAgentEvent) {
  return (
    event.eventType === "command.started" ||
    event.eventType === "command.output" ||
    event.eventType === "command.completed"
  )
}

function isTodoListEvent(event: TaskAgentEvent) {
  return (
    event.eventType === "todo_list" ||
    event.eventType === "todo_list.started" ||
    event.eventType === "todo_list.updated" ||
    event.eventType === "todo_list.completed"
  )
}

function toMessageBlock(event: TaskAgentEvent): ChatConversationBlock {
  const payload = asRecord(event.payload)
  const role = toStringOrNull(payload?.role)
  const parsedUserAttachments =
    role === "user" ? parseUserInputAttachments(payload) : []
  const content =
    role === "user"
      ? parseUserInputText(payload) ?? formatUserInputContent(payload) ?? eventContent(event)
      : eventContent(event)

  if (role === "user" || role === "assistant") {
    return {
      id: event.id,
      type: "message",
      role,
      content,
      attachments:
        parsedUserAttachments.length > 0 ? parsedUserAttachments : undefined,
      timestamp: eventTimestamp(event),
    }
  }

  return {
    id: event.id,
    type: "event",
    label: toStringOrNull(payload?.source) ?? "message",
    content,
    timestamp: eventTimestamp(event),
    tone: "neutral",
  }
}

function toFileChangeBlock(
  event: TaskAgentEvent,
): Extract<ChatConversationBlock, { type: "file-change" }> {
  const payload = asRecord(event.payload)

  return {
    id: event.id,
    type: "file-change",
    timestamp: eventTimestamp(event),
    status: toStringOrNull(payload?.status) === "failed" ? "failed" : "success",
    changeId: toStringOrNull(payload?.changeId),
    changes: parseFileChanges(payload),
    event,
  }
}

function toWebSearchBlock(
  event: TaskAgentEvent,
): Extract<ChatConversationBlock, { type: "web-search" }> {
  const payload = asRecord(event.payload)

  return {
    id: event.id,
    type: "web-search",
    timestamp: eventTimestamp(event),
    status: event.eventType === "web_search.completed" ? "completed" : "running",
    searchId: toStringOrNull(payload?.searchId),
    query: toStringOrNull(payload?.query) ?? "(empty)",
    event,
  }
}

function toMcpToolCallBlock(
  event: TaskAgentEvent,
): Extract<ChatConversationBlock, { type: "mcp-tool-call" }> {
  const payload = asRecord(event.payload)
  const status =
    event.eventType === "mcp_tool_call.started"
      ? "running"
      : toStringOrNull(payload?.status) === "failed"
        ? "failed"
        : "success"

  return {
    id: event.id,
    type: "mcp-tool-call",
    timestamp: eventTimestamp(event),
    status,
    callId: toStringOrNull(payload?.callId),
    server: toStringOrNull(payload?.server),
    tool: toStringOrNull(payload?.tool),
    argumentsText: stringifyPretty(payload?.arguments ?? {}),
    resultText:
      payload?.result === undefined ? null : stringifyPretty(payload.result),
    errorText: toStringOrNull(payload?.error),
    event,
  }
}

function createCommandGroup(
  event: TaskAgentEvent,
  commandId: string,
): Extract<ChatConversationBlock, { type: "command-group" }> {
  const payload = asRecord(event.payload)

  return {
    id: event.id,
    type: "command-group",
    commandId,
    command: toStringOrNull(payload?.command) ?? `Command ${commandId}`,
    output: "",
    outputPreview: null,
    outputLineCount: 0,
    hasMoreOutput: false,
    startedAt: null,
    completedAt: null,
    timestamp: eventTimestamp(event),
    status: "running",
    exitCode: null,
  }
}

function appendCommandEventToGroup(
  group: Extract<ChatConversationBlock, { type: "command-group" }>,
  event: TaskAgentEvent,
) {
  const payload = asRecord(event.payload)

  if (event.eventType === "command.started") {
    group.command = toStringOrNull(payload?.command) ?? group.command
    group.startedAt = eventTimestamp(event)
    group.timestamp = group.startedAt
    group.status = "running"
    return
  }

  if (event.eventType === "command.output") {
    const nextOutput = toStringOrNull(payload?.output) ?? ""
    if (nextOutput) {
      group.output = nextOutput
      updateCommandOutputMeta(group)
    }
    group.timestamp = eventTimestamp(event)
    return
  }

  group.completedAt = eventTimestamp(event)
  group.timestamp = group.completedAt
  group.status = toStringOrNull(payload?.status) === "failed" ? "failed" : "success"
  group.exitCode = typeof payload?.exitCode === "number" ? payload.exitCode : null
}

function createTodoListBlock(
  event: TaskAgentEvent,
  todoListId: string,
): Extract<ChatConversationBlock, { type: "todo-list" }> {
  const timestamp = eventTimestamp(event)

  return {
    id: event.id,
    type: "todo-list",
    todoListId,
    items: parseTodoListItems(asRecord(event.payload)),
    startedAt:
      event.eventType === "todo_list.started" || event.eventType === "todo_list"
        ? timestamp
        : null,
    updatedAt: timestamp,
    completedAt: event.eventType === "todo_list.completed" ? timestamp : null,
    timestamp,
    status: event.eventType === "todo_list.completed" ? "completed" : "running",
  }
}

function applyTodoListEventToBlock(
  block: Extract<ChatConversationBlock, { type: "todo-list" }>,
  event: TaskAgentEvent,
) {
  const timestamp = eventTimestamp(event)
  const payload = asRecord(event.payload)

  block.items = parseTodoListItems(payload)
  block.timestamp = timestamp
  block.updatedAt = timestamp

  if (
    event.eventType === "todo_list.started" ||
    event.eventType === "todo_list" ||
    block.startedAt === null
  ) {
    block.startedAt = timestamp
  }

  if (event.eventType === "todo_list.completed") {
    block.completedAt = timestamp
    block.status = "completed"
    return
  }

  block.completedAt = null
  block.status = "running"
}

function pushTodoListBlock(
  event: TaskAgentEvent,
  blocks: ChatConversationBlock[],
  todoLists: Map<
    string,
    Extract<ChatConversationBlock, { type: "todo-list" }>
  >,
) {
  const payload = asRecord(event.payload)
  const todoListId = toStringOrNull(payload?.todoListId) ?? event.id

  let block = todoLists.get(todoListId)
  if (!block) {
    block = createTodoListBlock(event, todoListId)
    todoLists.set(todoListId, block)
    blocks.push(block)
  } else {
    applyTodoListEventToBlock(block, event)
  }
}

function pushCommandBlock(
  event: TaskAgentEvent,
  blocks: ChatConversationBlock[],
  commandGroups: Map<
    string,
    Extract<ChatConversationBlock, { type: "command-group" }>
  >,
) {
  const payload = asRecord(event.payload)
  const commandId = toStringOrNull(payload?.commandId)

  if (!commandId) {
    blocks.push(toEventBlock(event))
    return
  }

  let group = commandGroups.get(commandId)
  if (!group) {
    group = createCommandGroup(event, commandId)
    commandGroups.set(commandId, group)
    blocks.push(group)
  }

  appendCommandEventToGroup(group, event)
}

function toEventBlock(event: TaskAgentEvent): ChatConversationBlock {
  return {
    id: event.id,
    type: "event",
    label: event.eventType,
    content: eventContent(event),
    timestamp: eventTimestamp(event),
    tone: eventTone(event),
  }
}

export function toConversationBlocks(
  events: TaskAgentEvent[],
): ChatConversationBlock[] {
  const blocks: ChatConversationBlock[] = []
  return appendConversationBlocks(blocks, events)
}

export function appendConversationBlocks(
  currentBlocks: ChatConversationBlock[],
  events: TaskAgentEvent[],
): ChatConversationBlock[] {
  const blocks: ChatConversationBlock[] = [...currentBlocks]
  const commandGroups = new Map<
    string,
    Extract<ChatConversationBlock, { type: "command-group" }>
  >()
  const todoLists = new Map<
    string,
    Extract<ChatConversationBlock, { type: "todo-list" }>
  >()

  for (const block of blocks) {
    if (block.type === "command-group") {
      commandGroups.set(block.commandId, block)
    }
    if (block.type === "todo-list") {
      todoLists.set(block.todoListId, block)
    }
  }

  for (const event of events) {
    if (HIDDEN_EVENT_TYPES.has(event.eventType)) {
      continue
    }

    if (event.eventType === "message") {
      blocks.push(toMessageBlock(event))
      continue
    }

    if (isCommandEvent(event)) {
      pushCommandBlock(event, blocks, commandGroups)
      continue
    }

    if (isTodoListEvent(event)) {
      pushTodoListBlock(event, blocks, todoLists)
      continue
    }

    if (event.eventType === "file_change") {
      blocks.push(toFileChangeBlock(event))
      continue
    }

    if (
      event.eventType === "web_search.started" ||
      event.eventType === "web_search.completed"
    ) {
      blocks.push(toWebSearchBlock(event))
      continue
    }

    if (
      event.eventType === "mcp_tool_call.started" ||
      event.eventType === "mcp_tool_call.completed"
    ) {
      blocks.push(toMcpToolCallBlock(event))
      continue
    }

    blocks.push(toEventBlock(event))
  }

  return blocks
}
