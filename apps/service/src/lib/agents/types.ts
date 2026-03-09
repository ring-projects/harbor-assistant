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
  sandboxMode?: "workspace-write" | "workspace-read" | "isolated"
  approvalPolicy?: "never" | "on-request" | "on-failure" | "untrusted"
  networkAccessEnabled?: boolean
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
