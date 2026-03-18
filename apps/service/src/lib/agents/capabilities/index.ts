import type { AgentCapabilityResult, AgentType } from "../types"
import { inspectCodexCapabilities } from "./codex"
import { inspectClaudeCodeCapabilities } from "./claude-code"

/**
 * Inspect all agent capabilities
 */
export async function inspectAllAgentCapabilities(args?: {
  harborHomeDirectory?: string
}): Promise<AgentCapabilityResult> {
  const [codexCapabilities, claudeCodeCapabilities] = await Promise.all([
    inspectCodexCapabilities({
      harborHomeDirectory: args?.harborHomeDirectory,
    }),
    inspectClaudeCodeCapabilities(),
  ])

  const agents = {
    codex: codexCapabilities,
    "claude-code": claudeCodeCapabilities,
  }

  const availableAgents: AgentType[] = []
  for (const [type, capabilities] of Object.entries(agents)) {
    if (capabilities.installed) {
      availableAgents.push(type as AgentType)
    }
  }

  return {
    checkedAt: new Date(),
    agents,
    availableAgents,
  }
}
