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

function executionSource(event: TaskAgentEvent) {
  const payload = asRecord(event.payload)
  switch (event.eventType) {
    case "command.started":
    case "command.output":
    case "command.completed":
      return toStringOrNull(payload?.commandId)
    case "web_search.started":
    case "web_search.completed":
      return toStringOrNull(payload?.searchId)
    case "file_change":
      return toStringOrNull(payload?.changeId)
    case "mcp_tool_call.started":
    case "mcp_tool_call.completed": {
      const server = toStringOrNull(payload?.server)
      const tool = toStringOrNull(payload?.tool)
      return server && tool ? `${server}.${tool}` : toStringOrNull(payload?.callId)
    }
    default:
      return null
  }
}

function executionTone(event: TaskAgentEvent): "neutral" | "error" | "success" {
  if (
    event.eventType === "command.completed" ||
    event.eventType === "file_change" ||
    event.eventType === "mcp_tool_call.completed"
  ) {
    const payload = asRecord(event.payload)
    const status = toStringOrNull(payload?.status)
    return status === "failed" ? "error" : "success"
  }

  return "neutral"
}

function eventTone(event: TaskAgentEvent): "neutral" | "error" | "success" {
  if (event.eventType === "error" || event.eventType === "turn.failed") {
    return "error"
  }

  return "neutral"
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

    const payload = asRecord(event.payload)

    if (event.eventType === "message") {
      const role = toStringOrNull(payload?.role)
      const content = eventContent(event)

      if (role === "user" || role === "assistant") {
        blocks.push({
          id: event.id,
          type: "message",
          role,
          content,
          timestamp: eventTimestamp(event),
        } satisfies ChatConversationBlock)
        continue
      }

      blocks.push({
        id: event.id,
        type: "event",
        label: toStringOrNull(payload?.source) ?? "message",
        content,
        timestamp: eventTimestamp(event),
        tone: "neutral",
      } satisfies ChatConversationBlock)
      continue
    }

    if (
      event.eventType === "command.started" ||
      event.eventType === "command.output" ||
      event.eventType === "command.completed"
    ) {
      const commandId = toStringOrNull(payload?.commandId)

      if (!commandId) {
        blocks.push({
          id: event.id,
          type: "execution",
          label: event.eventType,
          content: eventContent(event),
          timestamp: eventTimestamp(event),
          tone: executionTone(event),
          source: executionSource(event),
          event,
        } satisfies ChatConversationBlock)
        continue
      }

      let group = commandGroups.get(commandId)
      if (!group) {
        group = {
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
        commandGroups.set(commandId, group)
        blocks.push(group)
      }

      if (event.eventType === "command.started") {
        group.command = toStringOrNull(payload?.command) ?? group.command
        group.startedAt = eventTimestamp(event)
        group.timestamp = group.startedAt
        group.status = "running"
        continue
      }

      if (event.eventType === "command.output") {
        const nextOutput = toStringOrNull(payload?.output) ?? ""
        if (nextOutput) {
          group.output = `${group.output}${nextOutput}`
        }
        group.timestamp = eventTimestamp(event)
        continue
      }

      group.completedAt = eventTimestamp(event)
      group.timestamp = group.completedAt
      group.status = toStringOrNull(payload?.status) === "failed" ? "failed" : "success"
      group.exitCode =
        typeof payload?.exitCode === "number" ? payload.exitCode : null
      continue
    }

    if (
      event.eventType === "web_search.started" ||
      event.eventType === "web_search.completed" ||
      event.eventType === "file_change" ||
      event.eventType === "mcp_tool_call.started" ||
      event.eventType === "mcp_tool_call.completed"
    ) {
      blocks.push({
        id: event.id,
        type: "execution",
        label: event.eventType,
        content: eventContent(event),
        timestamp: eventTimestamp(event),
        tone: executionTone(event),
        source: executionSource(event),
        event,
      } satisfies ChatConversationBlock)
      continue
    }

    blocks.push({
      id: event.id,
      type: "event",
      label: event.eventType,
      content: eventContent(event),
      timestamp: eventTimestamp(event),
      tone: eventTone(event),
    } satisfies ChatConversationBlock)
  }

  return blocks
}
