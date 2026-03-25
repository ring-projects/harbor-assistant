import { projectClaudeRawEvent } from "./projectors/claude-code"
import { projectCodexRawEvent } from "./projectors/codex"
import type { HarborAgentEvent, RawAgentEventRecord } from "./types"

function projectRawEventToHarborEvents(
  rawEvent: RawAgentEventRecord,
): HarborAgentEvent[] {
  switch (rawEvent.agentType) {
    case "codex":
      return projectCodexRawEvent(rawEvent)
    case "claude-code":
      return projectClaudeRawEvent(rawEvent)
    default:
      return []
  }
}

export function projectRawEvent(rawEvent: RawAgentEventRecord) {
  return projectRawEventToHarborEvents(rawEvent)
}
