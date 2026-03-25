import type { HarborAgentEvent, RawAgentEventRecord } from "../types"
import { asRecord, toDateOrNow, toStringOrNull } from "../utils"

export function projectSyntheticRawEvent(
  rawEvent: RawAgentEventRecord,
): HarborAgentEvent[] {
  const timestamp = toDateOrNow(rawEvent.createdAt)
  const payload = asRecord(rawEvent.rawPayload)

  switch (rawEvent.rawEventType) {
    case "harbor.user_prompt": {
      const content = toStringOrNull(payload?.content)?.trim()
      if (!content) {
        return []
      }

      return [
        {
          type: "message",
          role: "user",
          content,
          source: toStringOrNull(payload?.source) ?? "user_prompt",
          timestamp,
        },
      ]
    }

    case "harbor.session.started": {
      const sessionId = toStringOrNull(payload?.sessionId)
      if (!sessionId) {
        return []
      }

      return [
        {
          type: "lifecycle",
          scope: "session",
          phase: "started",
          sessionId,
          timestamp,
        },
      ]
    }

    case "harbor.turn.started":
      return [
        {
          type: "lifecycle",
          scope: "turn",
          phase: "started",
          timestamp,
        },
      ]

    case "harbor.turn.completed":
      return [
        {
          type: "lifecycle",
          scope: "turn",
          phase: "completed",
          timestamp,
        },
      ]

    case "harbor.error": {
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

    default:
      return []
  }
}
