import type { TaskAgentEvent } from "@/modules/tasks/contracts"

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
      event: TaskAgentEvent
    }
  | {
      id: string
      type: "command-group"
      commandId: string
      command: string
      output: string
      startedAt: string | null
      completedAt: string | null
      timestamp: string | null
      status: "running" | "success" | "failed"
      exitCode: number | null
    }
  | {
      id: string
      type: "typing"
      label: string
    }
