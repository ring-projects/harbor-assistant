import type { HarborAgentEvent, RawAgentEventRecord } from "../types"
import {
  asRecord,
  toDateOrNow,
  toNumberOrNull,
  toStringOrNull,
} from "../utils"
import { projectSyntheticRawEvent } from "./synthetic"

export function projectCodexRawEvent(
  rawEvent: RawAgentEventRecord,
): HarborAgentEvent[] {
  if (rawEvent.rawEventType.startsWith("harbor.")) {
    return projectSyntheticRawEvent(rawEvent)
  }

  const timestamp = toDateOrNow(rawEvent.createdAt)
  const payload = asRecord(rawEvent.rawPayload)

  switch (rawEvent.rawEventType) {
    case "thread.started": {
      const threadId = toStringOrNull(payload?.thread_id)
      if (!threadId) {
        return []
      }

      return [
        {
          type: "lifecycle",
          scope: "session",
          phase: "started",
          sessionId: threadId,
          timestamp,
        },
      ]
    }

    case "turn.started":
      return [
        {
          type: "lifecycle",
          scope: "turn",
          phase: "started",
          timestamp,
        },
      ]

    case "turn.completed":
      return [
        {
          type: "lifecycle",
          scope: "turn",
          phase: "completed",
          timestamp,
        },
      ]

    case "turn.failed": {
      const error = asRecord(payload?.error)
      const message = toStringOrNull(error?.message)
      if (!message) {
        return []
      }

      return [
        {
          type: "lifecycle",
          scope: "turn",
          phase: "failed",
          error: message,
          timestamp,
        },
      ]
    }

    case "error": {
      const message = toStringOrNull(payload?.message)
      if (!message) {
        return []
      }

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

    case "item.started":
    case "item.updated":
    case "item.completed": {
      const item = asRecord(payload?.item)
      if (!item) {
        return []
      }

      const itemType = toStringOrNull(item.type)
      if (itemType === "command_execution") {
        const activityId = toStringOrNull(item.id)
        const command = toStringOrNull(item.command)
        if (!activityId || !command) {
          return []
        }

        const outputSnapshot = toStringOrNull(item.aggregated_output) ?? ""

        const events: HarborAgentEvent[] = []

        if (rawEvent.rawEventType === "item.started") {
          events.push({
            type: "activity",
            activityId,
            kind: "command",
            phase: "started",
            title: command,
            summary: command,
            input: {
              command,
            },
            timestamp,
          })
        }

        if (outputSnapshot) {
          events.push({
            type: "activity",
            activityId,
            kind: "command",
            phase: "progress",
            title: command,
            summary: command,
            output: outputSnapshot,
            timestamp,
          })
        }

        if (rawEvent.rawEventType === "item.completed") {
          events.push({
            type: "activity",
            activityId,
            kind: "command",
            phase: "completed",
            title: command,
            summary: command,
            status:
              toStringOrNull(item.status) === "completed" ? "success" : "failed",
            metadata:
              typeof item.exit_code === "number"
                ? { exitCode: toNumberOrNull(item.exit_code) }
                : undefined,
            timestamp,
          })
        }

        return events
      }

      if (itemType === "agent_message" && rawEvent.rawEventType === "item.completed") {
        const text = toStringOrNull(item.text)?.trim()
        if (!text) {
          return []
        }

        return [
          {
            type: "message",
            role: "assistant",
            content: text,
            source: "agent_message",
            externalId: toStringOrNull(item.id) ?? undefined,
            timestamp,
          },
        ]
      }

      if (itemType === "reasoning" && rawEvent.rawEventType === "item.completed") {
        const text = toStringOrNull(item.text)?.trim()
        if (!text) {
          return []
        }

        return [
          {
            type: "reasoning",
            content: text,
            source: "codex",
            timestamp,
          },
        ]
      }

      if (itemType === "web_search") {
        const activityId = toStringOrNull(item.id)
        const query = toStringOrNull(item.query)
        if (!activityId || !query) {
          return []
        }

        if (rawEvent.rawEventType === "item.started") {
          return [
            {
              type: "activity",
              activityId,
              kind: "web_search",
              phase: "started",
              title: "Web search",
              summary: query,
              input: { query },
              timestamp,
            },
          ]
        }

        if (rawEvent.rawEventType === "item.completed") {
          return [
            {
              type: "activity",
              activityId,
              kind: "web_search",
              phase: "completed",
              title: "Web search",
              summary: query,
              status: "success",
              input: { query },
              timestamp,
            },
          ]
        }

        return []
      }

      if (itemType === "file_change" && rawEvent.rawEventType === "item.completed") {
        const activityId = toStringOrNull(item.id)
        if (!activityId) {
          return []
        }

        const changes = Array.isArray(item.changes) ? item.changes : []
        const normalizedChanges = changes
          .map((change) => {
            const source = asRecord(change)
            const path = toStringOrNull(source?.path)
            const kind = source?.kind
            if (!path || (kind !== "add" && kind !== "delete" && kind !== "update")) {
              return null
            }

            return {
              path,
              kind,
            }
          })
          .filter((change): change is NonNullable<typeof change> => Boolean(change))

        return [
          {
            type: "activity",
            activityId,
            kind: "file_change",
            phase: "completed",
            title: "File change",
            status:
              toStringOrNull(item.status) === "completed" ? "success" : "failed",
            result: {
              changes: normalizedChanges,
            },
            timestamp,
          },
        ]
      }

      if (itemType === "mcp_tool_call") {
        const activityId = toStringOrNull(item.id)
        const server = toStringOrNull(item.server)
        const tool = toStringOrNull(item.tool)
        if (!activityId || !server || !tool) {
          return []
        }

        const title = `${server}/${tool}`

        if (rawEvent.rawEventType === "item.started") {
          return [
            {
              type: "activity",
              activityId,
              kind: "mcp_tool",
              phase: "started",
              title,
              summary: tool,
              input: item.arguments,
              timestamp,
            },
          ]
        }

        if (rawEvent.rawEventType === "item.completed") {
          const error = asRecord(item.error)

          return [
            {
              type: "activity",
              activityId,
              kind: "mcp_tool",
              phase: "completed",
              title,
              summary: tool,
              status:
                toStringOrNull(item.status) === "completed" ? "success" : "failed",
              input: item.arguments,
              result: item.result,
              error: toStringOrNull(error?.message) ?? undefined,
              timestamp,
            },
          ]
        }
      }

      if (itemType === "todo_list" && rawEvent.rawEventType === "item.completed") {
        const items = Array.isArray(item.items) ? item.items : []
        const todoItems = items
          .map((entry) => {
            const source = asRecord(entry)
            const text = toStringOrNull(source?.text)
            if (!text) {
              return null
            }

            return {
              text,
              completed: source?.completed === true,
            }
          })
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

        return [
          {
            type: "activity",
            activityId: toStringOrNull(item.id) ?? "todo-list",
            kind: "tool",
            phase: "completed",
            title: "Todo list",
            result: {
              items: todoItems,
            },
            timestamp,
          },
        ]
      }

      if (itemType === "error" && rawEvent.rawEventType === "item.completed") {
        const message = toStringOrNull(item.message)
        if (!message) {
          return []
        }

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

      return []
    }

    default:
      return []
  }
}
