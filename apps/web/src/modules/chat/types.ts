import type { TaskTimelineItem } from "@/modules/tasks/contracts"

export type ChatMessageRole = "user" | "assistant"

export type ChatConversationBlock =
  | {
      id: string
      type: "message"
      role: ChatMessageRole
      content: string
      timestamp: string | null
      pending?: boolean
    }
  | {
      id: string
      type: "event"
      label: string
      content: string
      timestamp: string | null
      tone: "neutral" | "success" | "error"
    }
  | {
      id: string
      type: "execution"
      label: string
      content: string
      timestamp: string | null
      tone: "neutral" | "error" | "success"
      source: string | null
      item: TaskTimelineItem
    }
  | {
      id: string
      type: "typing"
      label: string
    }
