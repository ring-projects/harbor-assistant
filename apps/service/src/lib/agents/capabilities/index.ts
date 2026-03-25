import type { AgentCapabilityResult } from "../types"
import { AgentFactory } from "../factory"

/**
 * Get all declared agent capabilities
 */
export async function getAgentCapabilities(): Promise<AgentCapabilityResult> {
  return AgentFactory.inspectAll()
}
