import type { AgentCapabilities } from "../types"
import { getConfiguredAgentModels } from "../model-config"

export const CLAUDE_CODE_DECLARED_CAPABILITIES: AgentCapabilities = {
  models: getConfiguredAgentModels("claude-code"),
  supportsResume: true,
  supportsStreaming: true,
}

export async function getClaudeCodeCapabilities(): Promise<AgentCapabilities> {
  return {
    ...CLAUDE_CODE_DECLARED_CAPABILITIES,
    models: getConfiguredAgentModels("claude-code"),
  }
}
