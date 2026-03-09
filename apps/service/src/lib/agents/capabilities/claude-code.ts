import type { AgentCapabilities } from "../types"
import {
  findInstalledCommand,
  resolveCommandVersion,
} from "../utils/command"
import { AGENT_COMMANDS } from "../constants"

/**
 * Inspect Claude Code agent capabilities
 */
export async function inspectClaudeCodeCapabilities(): Promise<AgentCapabilities> {
  const command = await findInstalledCommand(AGENT_COMMANDS["claude-code"])

  if (!command) {
    return {
      installed: false,
      version: null,
      models: [],
      supportsResume: false,
      supportsStreaming: false,
    }
  }

  // TODO: Implement Claude Code model list retrieval
  // Currently returns basic information only
  return {
    installed: true,
    version: await resolveCommandVersion(command),
    models: [],
    supportsResume: true,
    supportsStreaming: true,
  }
}
