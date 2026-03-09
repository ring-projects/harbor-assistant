import { inspectAllAgentCapabilities } from "../../lib/agents"
import type { AgentCapabilityResult } from "../../lib/agents"

/**
 * Get all agent capabilities information
 * Replaces the old executor capabilities
 */
export async function getAgentCapabilities(): Promise<AgentCapabilityResult> {
  return inspectAllAgentCapabilities()
}
