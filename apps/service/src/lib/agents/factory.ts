import type { AgentType } from "./types"
import type { IAgent } from "./interface"
import { codexAdapter } from "./adapters/codex"
import { claudeCodeAdapter } from "./adapters/claude-code"

/**
 * Agent factory
 * Returns the corresponding agent adapter instance based on type
 */
export class AgentFactory {
  private static readonly adapters: Record<AgentType, IAgent> = {
    codex: codexAdapter,
    "claude-code": claudeCodeAdapter,
  }

  /**
   * Get agent adapter for specified type
   */
  static getAgent(type: AgentType): IAgent {
    const adapter = this.adapters[type]
    if (!adapter) {
      throw new Error(`Unknown agent type: ${type}`)
    }
    return adapter
  }

  /**
   * Get all available agent types
   */
  static getAvailableTypes(): AgentType[] {
    return Object.keys(this.adapters) as AgentType[]
  }
}
