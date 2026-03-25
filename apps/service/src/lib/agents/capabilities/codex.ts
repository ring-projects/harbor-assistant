import type { AgentCapabilities } from "../types"
import { getConfiguredAgentModels } from "../model-config"

export const CODEX_DECLARED_CAPABILITIES: AgentCapabilities = {
  models: getConfiguredAgentModels("codex"),
  supportsResume: true,
  supportsStreaming: true,
}

export function getCodexDeclaredCapabilities(): AgentCapabilities {
  return {
    ...CODEX_DECLARED_CAPABILITIES,
    models: getConfiguredAgentModels("codex"),
  }
}

export async function getCodexCapabilities(): Promise<AgentCapabilities> {
  // Codex model choices are declared by Harbor until the SDK exposes
  // an authoritative model catalog API.
  return getCodexDeclaredCapabilities()
}
