export type HarborAgentType = "codex" | "claude-code"

export type RawAgentEventRecord = {
  id: string
  sequence: number
  agentType: HarborAgentType
  rawEventType: string
  rawPayload: Record<string, unknown>
  createdAt: string
}

export type HarborLifecycleEvent = {
  type: "lifecycle"
  scope: "session" | "turn" | "runtime"
  phase: "started" | "completed" | "failed" | "error"
  timestamp: Date
  sessionId?: string
  error?: string
  metadata?: Record<string, unknown>
}

export type HarborMessageEvent = {
  type: "message"
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  source?: string
  externalId?: string
}

export type HarborReasoningEvent = {
  type: "reasoning"
  content: string
  timestamp: Date
  source?: string
}

export type HarborActivityKind =
  | "command"
  | "web_search"
  | "mcp_tool"
  | "file_change"
  | "tool"
  | "unknown"

export type HarborActivityEvent = {
  type: "activity"
  activityId: string
  kind?: HarborActivityKind
  phase: "started" | "progress" | "completed"
  timestamp: Date
  title?: string
  status?: "success" | "failed"
  summary?: string
  input?: unknown
  output?: string
  result?: unknown
  error?: string
  metadata?: Record<string, unknown>
}

export type HarborAgentEvent =
  | HarborLifecycleEvent
  | HarborMessageEvent
  | HarborReasoningEvent
  | HarborActivityEvent
