import type { IAgent } from "../interface"
import type { AgentCapabilities, SessionOptions, AgentEvent } from "../types"
import { inspectClaudeCodeCapabilities } from "../capabilities/claude-code"

/**
 * Claude Code agent adapter
 * TODO: Implement Claude Code SDK integration
 */
export class ClaudeCodeAdapter implements IAgent {
  getType(): string {
    return "claude-code"
  }

  async *startSessionAndRun(
    options: SessionOptions,
    prompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    throw new Error("Claude Code adapter not implemented yet")
  }

  async *resumeSessionAndRun(
    sessionId: string,
    options: SessionOptions,
    prompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    throw new Error("Claude Code adapter not implemented yet")
  }

  async getCapabilities(): Promise<AgentCapabilities> {
    return inspectClaudeCodeCapabilities()
  }
}

/**
 * Claude Code adapter singleton
 */
export const claudeCodeAdapter = new ClaudeCodeAdapter()
