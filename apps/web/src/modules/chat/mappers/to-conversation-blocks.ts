import type { TaskAgentEvent } from "@/modules/tasks/contracts"

import type { ChatConversationBlock } from "../types"

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
  return toStringOrNull(payload?.commandId)
}

function executionTone(event: TaskAgentEvent): "neutral" | "error" | "success" {
  if (event.eventType === "command.completed") {
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
  return events.map((event) => {
    const payload = asRecord(event.payload)

    if (event.eventType === "message") {
      const role = toStringOrNull(payload?.role)
      const content = eventContent(event)

      if (role === "user" || role === "assistant") {
        return {
          id: event.id,
          type: "message",
          role,
          content,
          timestamp: eventTimestamp(event),
        } satisfies ChatConversationBlock
      }

      return {
        id: event.id,
        type: "event",
        label: toStringOrNull(payload?.source) ?? "message",
        content,
        timestamp: eventTimestamp(event),
        tone: "neutral",
      } satisfies ChatConversationBlock
    }

    if (
      event.eventType === "command.started" ||
      event.eventType === "command.output"
    ) {
      return {
        id: event.id,
        type: "execution",
        label: event.eventType,
        content: eventContent(event),
        timestamp: eventTimestamp(event),
        tone: executionTone(event),
        source: executionSource(event),
        event,
      } satisfies ChatConversationBlock
    }

    return {
      id: event.id,
      type: "event",
      label: event.eventType,
      content: eventContent(event),
      timestamp: eventTimestamp(event),
      tone: eventTone(event),
    } satisfies ChatConversationBlock
  })
}
