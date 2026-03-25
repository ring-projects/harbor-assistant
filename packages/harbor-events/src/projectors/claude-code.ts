import type {
  HarborActivityKind,
  HarborAgentEvent,
  RawAgentEventRecord,
} from "../types"
import { asRecord, toDateOrNow, toStringOrNull } from "../utils"
import { projectSyntheticRawEvent } from "./synthetic"

function extractClaudeContentBlocks(value: unknown) {
  if (typeof value === "string") {
    return [value] as unknown[]
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value
}

function extractClaudeTextFromBlock(block: unknown): string {
  if (typeof block === "string") {
    return block
  }

  const source = asRecord(block)
  if (!source) {
    return ""
  }

  if (typeof source.text === "string") {
    return source.text
  }

  if (typeof source.thinking === "string") {
    return source.thinking
  }

  if (typeof source.content === "string") {
    return source.content
  }

  if (Array.isArray(source.content)) {
    return source.content.map((item) => extractClaudeTextFromBlock(item)).join("")
  }

  return ""
}

function extractClaudeTextFromContent(content: unknown) {
  return extractClaudeContentBlocks(content)
    .map((block) => extractClaudeTextFromBlock(block))
    .join("")
    .trim()
}

function inferClaudeActivityKind(name: string): HarborActivityKind {
  const normalized = name.trim().toLowerCase()

  if (
    normalized === "bash" ||
    normalized === "shell" ||
    normalized.includes("command")
  ) {
    return "command"
  }

  if (normalized.includes("mcp")) {
    return "mcp_tool"
  }

  if (normalized.includes("websearch") || normalized.includes("web_search")) {
    return "web_search"
  }

  return "tool"
}

export function projectClaudeRawEvent(
  rawEvent: RawAgentEventRecord,
): HarborAgentEvent[] {
  if (rawEvent.rawEventType.startsWith("harbor.")) {
    return projectSyntheticRawEvent(rawEvent)
  }

  const timestamp = toDateOrNow(rawEvent.createdAt)
  const payload = asRecord(rawEvent.rawPayload)

  switch (rawEvent.rawEventType) {
    case "assistant": {
      const message = asRecord(payload?.message)
      const content = extractClaudeContentBlocks(message?.content)
      const events: HarborAgentEvent[] = []

      for (const block of content) {
        const source = asRecord(block)
        if (!source) {
          continue
        }

        if (source.type === "thinking") {
          const thinking = extractClaudeTextFromBlock(source).trim()
          if (thinking) {
            events.push({
              type: "reasoning",
              content: thinking,
              source: "claude",
              timestamp,
            })
          }
          continue
        }

        if (source.type === "tool_use") {
          const activityId = toStringOrNull(source.id)
          const name = toStringOrNull(source.name)
          if (!activityId || !name) {
            continue
          }

          const kind = inferClaudeActivityKind(name)
          const title = name
          const input = source.input
          const summary =
            typeof input === "string" ? input : JSON.stringify(input ?? {})

          events.push({
            type: "activity",
            activityId,
            kind,
            phase: "started",
            title,
            summary: summary === "{}" ? undefined : summary,
            input,
            timestamp,
          })
          continue
        }

        if (source.type === "tool_result") {
          const activityId = toStringOrNull(source.tool_use_id)
          if (!activityId) {
            continue
          }

          const output = extractClaudeTextFromBlock(source).trim()

          if (output) {
            events.push({
              type: "activity",
              activityId,
              kind: "tool",
              phase: "progress",
              title: "Tool result",
              output,
              timestamp,
            })
          }

          events.push({
            type: "activity",
            activityId,
            kind: "tool",
            phase: "completed",
            title: "Tool result",
            status: source.is_error === true ? "failed" : "success",
            error: source.is_error === true ? output || "Tool call failed." : undefined,
            result: output || undefined,
            timestamp,
          })
        }
      }

      const messageContent = extractClaudeTextFromContent(message?.content)
      if (messageContent) {
        events.push({
          type: "message",
          role: "assistant",
          content: messageContent,
          source: "assistant_message",
          timestamp,
        })
      }

      return events
    }

    case "result":
    case "system.result": {
      const resultValue = payload?.result
      const resultText = extractClaudeTextFromContent(resultValue)
      const events: HarborAgentEvent[] = []

      if (resultText) {
        events.push({
          type: "message",
          role: "assistant",
          content: resultText,
          source: "result",
          timestamp,
        })
      }

      const result = asRecord(resultValue)
      if (result?.is_error === true) {
        const error =
          typeof result.result === "string"
            ? result.result
            : "Claude Code task failed."

        events.push({
          type: "lifecycle",
          scope: "turn",
          phase: "failed",
          error,
          timestamp,
        })
      } else {
        events.push({
          type: "lifecycle",
          scope: "turn",
          phase: "completed",
          timestamp,
        })
      }

      return events
    }

    case "error": {
      const error = toStringOrNull(payload?.error)
      const message = error || "Claude Code task failed."

      return [
        {
          type: "lifecycle",
          scope: "runtime",
          phase: "error",
          error: message,
          timestamp,
        },
      ]
    }

    default:
      return []
  }
}
