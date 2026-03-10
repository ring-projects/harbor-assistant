import type { TaskTimelineItem, TaskStatus } from "@/modules/tasks/contracts"

import type { ChatConversationBlock } from "../types"

function statusLabel(status: TaskStatus | null) {
  switch (status) {
    case "queued":
      return "Queued"
    case "running":
      return "Running"
    case "completed":
      return "Completed"
    case "failed":
      return "Failed"
    case "cancelled":
      return "Cancelled"
    default:
      return "Status"
  }
}

function contentOrFallback(item: TaskTimelineItem) {
  if (item.content?.trim()) {
    return item.content
  }

  if (item.payload?.trim()) {
    return item.payload
  }

  return "(empty)"
}

export function toConversationBlocks(
  items: TaskTimelineItem[],
): ChatConversationBlock[] {
  return items.map((item) => {
    if (item.kind === "message" && (item.role === "user" || item.role === "assistant")) {
      return {
        id: item.id,
        type: "message",
        role: item.role,
        content: contentOrFallback(item),
        timestamp: item.createdAt,
      } satisfies ChatConversationBlock
    }

    if (item.kind === "stdout" || item.kind === "stderr" || item.kind === "summary") {
      return {
        id: item.id,
        type: "execution",
        label:
          item.kind === "stdout"
            ? "stdout"
            : item.kind === "stderr"
              ? "stderr"
              : "summary",
        content: contentOrFallback(item),
        timestamp: item.createdAt,
        tone:
          item.kind === "summary"
            ? "success"
            : item.kind === "stderr"
              ? "error"
              : "neutral",
        source: item.source,
        item,
      } satisfies ChatConversationBlock
    }

    if (item.kind === "status") {
      return {
        id: item.id,
        type: "event",
        label: statusLabel(item.status),
        content: item.content?.trim() || `Task changed to ${statusLabel(item.status)}.`,
        timestamp: item.createdAt,
        tone:
          item.status === "completed"
            ? "success"
            : item.status === "failed" || item.status === "cancelled"
              ? "error"
              : "neutral",
      } satisfies ChatConversationBlock
    }

    return {
      id: item.id,
      type: item.kind === "error" ? "event" : "event",
      label: item.kind === "error" ? "Error" : item.kind,
      content: contentOrFallback(item),
      timestamp: item.createdAt,
      tone: item.kind === "error" ? "error" : "neutral",
    } satisfies ChatConversationBlock
  })
}
