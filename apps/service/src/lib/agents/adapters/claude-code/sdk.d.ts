export type ClaudePermissionMode =
  | "default"
  | "acceptEdits"
  | "bypassPermissions"
  | "plan"
  | "dontAsk"

export type ClaudeSdkMessage =
  | {
      type: "assistant"
      message: Record<string, unknown>
      parent_tool_use_id: string | null
      error?: string
      uuid: string
      session_id: string
    }
  | {
      type: "user"
      message: Record<string, unknown>
      parent_tool_use_id: string | null
      isSynthetic?: boolean
      tool_use_result?: unknown
      priority?: "now" | "next" | "later"
      timestamp?: string
      uuid?: string
      session_id: string
    }
  | {
      type: "system"
      subtype: string
      session_id: string
      uuid: string
      [key: string]: unknown
    }
  | {
      type: "result"
      subtype: string
      session_id: string
      uuid: string
      is_error: boolean
      result?: string
      errors?: string[]
      usage?: Record<string, unknown>
      structured_output?: unknown
      [key: string]: unknown
    }
  | {
      type: string
      session_id?: string
      uuid?: string
      [key: string]: unknown
    }

export type ClaudeQueryOptions = {
  abortController?: AbortController
  additionalDirectories?: string[]
  cwd?: string
  disallowedTools?: string[]
  env?: Record<string, string | undefined>
  effort?: "low" | "medium" | "high" | "max"
  model?: string
  permissionMode?: ClaudePermissionMode
  allowDangerouslySkipPermissions?: boolean
  resume?: string
  sandbox?: {
    enabled?: boolean
    autoAllowBashIfSandboxed?: boolean
    allowUnsandboxedCommands?: boolean
    filesystem?: {
      allowRead?: string[]
      allowWrite?: string[]
      allowManagedReadPathsOnly?: boolean
    }
  }
}

export interface ClaudeQuery extends AsyncIterable<ClaudeSdkMessage> {
  close(): void
}

export declare function query(args: {
  prompt: string
  options?: ClaudeQueryOptions
}): ClaudeQuery
