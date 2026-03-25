import type { TaskAgentEvent } from "@/modules/tasks/contracts"

import type { ChatConversationBlock } from "../types"

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

function toMessageBlock(event: TaskAgentEvent): ChatConversationBlock {
  const payload = asRecord(event.payload)
  const role = toStringOrNull(payload?.role)
  const content = eventContent(event)

  if (role === "user" || role === "assistant") {
    return {
      id: event.id,
      type: "message",
      role,
      content,
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
      group.output = `${group.output}${nextOutput}`
    }
    group.timestamp = eventTimestamp(event)
    return
  }

  group.completedAt = eventTimestamp(event)
  group.timestamp = group.completedAt
  group.status = toStringOrNull(payload?.status) === "failed" ? "failed" : "success"
  group.exitCode = typeof payload?.exitCode === "number" ? payload.exitCode : null
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
  const commandGroups = new Map<
    string,
    Extract<ChatConversationBlock, { type: "command-group" }>
  >()

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
