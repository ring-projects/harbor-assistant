/**
 * Agent type identifier
 */
export type AgentType = "codex" | "claude-code"

/**
 * Agent session configuration
 */
export type SessionOptions = {
  workingDirectory: string
  model?: string
  env?: Record<string, string>
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access"
  approvalPolicy?: "never" | "on-request" | "untrusted"
  networkAccessEnabled?: boolean
  webSearchMode?: "disabled" | "cached" | "live"
  additionalDirectories?: string[]
}

/**
 * Agent session
 */
export type AgentSession = {
  id: string
  agentType: AgentType
  options: SessionOptions
  createdAt: Date
}

/**
 * Agent event types
 */
export type AgentEvent =
  | {
      type: "session.started"
      sessionId: string
      timestamp: Date
    }
  | {
      type: "turn.started"
      timestamp: Date
    }
  | {
      type: "message"
      role: "user" | "assistant" | "system"
      content: string
      source: string
      externalId?: string
      timestamp: Date
    }
  | {
      type: "command.started"
      commandId: string
      command: string
      timestamp: Date
    }
  | {
      type: "command.output"
      commandId: string
      output: string
      timestamp: Date
    }
  | {
      type: "command.completed"
      commandId: string
      exitCode?: number
      status: "success" | "failed"
      timestamp: Date
    }
  | {
      type: "web_search.started"
      searchId: string
      query: string
      timestamp: Date
    }
  | {
      type: "web_search.completed"
      searchId: string
      query: string
      timestamp: Date
    }
  | {
      type: "file_change"
      changeId: string
      status: "success" | "failed"
      changes: Array<{
        path: string
        kind: "add" | "delete" | "update"
      }>
      timestamp: Date
    }
  | {
      type: "mcp_tool_call.started"
      callId: string
      server: string
      tool: string
      arguments: unknown
      timestamp: Date
    }
  | {
      type: "mcp_tool_call.completed"
      callId: string
      server: string
      tool: string
      status: "success" | "failed"
      arguments: unknown
      result?: unknown
      error?: string
      timestamp: Date
    }
  | {
      type: "reasoning"
      content: string
      timestamp: Date
    }
  | {
      type: "todo_list"
      items: Array<{ text: string; completed: boolean }>
      timestamp: Date
    }
  | {
      type: "error"
      message: string
      timestamp: Date
    }
  | {
      type: "turn.completed"
      timestamp: Date
    }
  | {
      type: "turn.failed"
      error: string
      timestamp: Date
    }
  | {
      type: "session.completed"
      timestamp: Date
    }

/**
 * Agent execution result
 */
export type AgentRunResult = {
  sessionId: string
  stdout: string
  stderr: string
}

/**
 * Agent model information
 */
export type AgentModel = {
  id: string
  displayName: string
  isDefault: boolean
}

/**
 * Agent capabilities information
 */
export type AgentCapabilities = {
  installed: boolean
  version: string | null
  models: AgentModel[]
  supportsResume: boolean
  supportsStreaming: boolean
}

/**
 * Agent capability detection result
 */
export type AgentCapabilityResult = {
  checkedAt: Date
  agents: Record<AgentType, AgentCapabilities>
  availableAgents: AgentType[]
}
