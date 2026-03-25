import type { TaskAgentEvent } from "@/modules/tasks/contracts"

export type ChatMessageRole = "user" | "assistant"
export type ChatInspectorBlockType =
  | "file-change"
  | "web-search"
  | "mcp-tool-call"
  | "command-group"

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
      type: "file-change"
      timestamp: string | null
      status: "success" | "failed"
      changeId: string | null
      changes: Array<{
        path: string
        kind: "add" | "delete" | "update"
      }>
      event: TaskAgentEvent
    }
  | {
      id: string
      type: "web-search"
      timestamp: string | null
      status: "running" | "completed"
      searchId: string | null
      query: string
      event: TaskAgentEvent
    }
  | {
      id: string
      type: "mcp-tool-call"
      timestamp: string | null
      status: "running" | "success" | "failed"
      callId: string | null
      server: string | null
      tool: string | null
      argumentsText: string
      resultText: string | null
      errorText: string | null
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

export type ChatInspectorBlock = Extract<
  ChatConversationBlock,
  { type: ChatInspectorBlockType }
>
